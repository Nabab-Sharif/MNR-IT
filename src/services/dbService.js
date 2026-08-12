// Database service for MNR IT Management System
// Uses IndexedDB for persistent storage with better capacity

import indexedDB from './indexedDBService';
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { entityLabel } from "@/lib/entityLabels";

function fireCloudLog(table, action, record) {
  try {
    const id = record && (record.id || record.name);
    logActivity({ action, entity: entityLabel(table), entity_id: id ? String(id) : null });
  } catch { /* noop */ }
}

async function cloudGetAll(table) {
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function cloudInsert(table, payload) {
  const clean = {};
  for (const [k, v] of Object.entries(payload || {})) if (v !== "" && v !== undefined) clean[k] = v;
  delete clean.id;
  const { data, error } = await supabase.from(table).insert(clean).select().single();
  if (error) throw error;
  fireCloudLog(table, "add", data);
  return data;
}
async function cloudUpdate(table, id, updates) {
  const clean = {};
  for (const [k, v] of Object.entries(updates || {})) if (v !== undefined) clean[k] = v;
  delete clean.id;
  delete clean.created_at;
  delete clean.updated_at;
  const { data, error } = await supabase.from(table).update(clean).eq("id", id).select().single();
  if (error) throw error;
  fireCloudLog(table, "edit", data);
  return data;
}
async function cloudDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  fireCloudLog(table, "delete", { id });
  return true;
}

class DBService {
  constructor() {
    this.dbReady = false;
    this.initializeData();
  }

  async initializeData() {
    await indexedDB.initDB();

    // Migrate from localStorage if needed
    const hasLocalStorage = localStorage.getItem('mnr_users') ||
      localStorage.getItem('mnr_departments');
    if (hasLocalStorage) {
      await indexedDB.migrateFromLocalStorage();
      console.log('Data migrated from localStorage to IndexedDB');
    }

    // One-time cleanup: force-remove previously seeded default departments/units
    if (!localStorage.getItem('mnr_default_seeds_cleaned_v2')) {
      try {
        const defaultDeptNames = ['Management', 'Merchandiser', 'IT', 'Accounts', 'HR,Admin & Compliance', 'Production', 'Quality', 'Store'];
        const departments = await indexedDB.getAll('departments');
        for (const d of departments) {
          if (d.unit === 'Unit-02' && defaultDeptNames.includes(d.name)) {
            await indexedDB.delete('departments', d.id);
          }
        }
        const units = await indexedDB.getAll('units');
        const assets = await indexedDB.getAll('it_assets');
        for (const u of units) {
          if ((u.name === 'Unit-01' && u.location === 'Secondary Office') ||
            (u.name === 'Unit-02' && u.location === 'Main Office')) {
            const remainingDepts = (await indexedDB.getAll('departments')).filter(d => d.unit === u.name);
            const unitAssets = assets.filter(a => a.unit_office === u.name);
            if (remainingDepts.length === 0 && unitAssets.length === 0) {
              await indexedDB.delete('units', u.id);
            }
          }
        }
        localStorage.setItem('mnr_default_seeds_cleaned_v2', '1');
      } catch (e) {
        console.warn('Default seed cleanup skipped:', e);
      }
    }

    this.dbReady = true;
  }

  // Users CRUD
  async getUsers() {
    return await indexedDB.getAll('users');
  }

  async addUser(user) {
    const newUser = {
      ...user,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return await indexedDB.add('users', newUser);
  }

  async updateUser(id, updates) {
    const user = await indexedDB.get('users', id);
    if (user) {
      const updatedUser = {
        ...user,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      return await indexedDB.put('users', updatedUser);
    }
    return null;
  }

  async deleteUser(id) {
    return await indexedDB.delete('users', id);
  }

  // Departments CRUD
  async getDepartments(scope) {
    const all = await indexedDB.getAll('departments');
    if (scope === undefined) return all.filter(d => !d.scope);
    return all.filter(d => d.scope === scope);
  }

  async addDepartment(department) {
    const newDepartment = {
      ...department,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return await indexedDB.add('departments', newDepartment);
  }

  async updateDepartment(id, updates) {
    const department = await indexedDB.get('departments', id);
    if (department) {
      const oldName = department.name;
      const unitScope = updates.unit || department.unit;
      const updatedDepartment = {
        ...department,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await indexedDB.put('departments', updatedDepartment);

      // If department name changed, update related records.
      // Skip global cascade when the department is scoped to a module (wifi/printers/etc).
      if (updates.name && updates.name !== oldName && !department.scope) {
        await this.updateDepartmentReferences(oldName, updates.name, unitScope);
      }

      return updatedDepartment;
    }
    return null;
  }

  async deleteDepartment(id) {
    const dept = await indexedDB.get('departments', id);
    if (dept && !dept.scope) {
      // Cascade delete IT assets in this department (matching unit + division)
      const norm = (v) => (v || '').toString().trim().toLowerCase();
      const assets = await indexedDB.getAll('it_assets');
      const toDelete = assets.filter(a =>
        norm(a.division) === norm(dept.name) &&
        (!dept.unit || norm(a.unit_office) === norm(dept.unit))
      );
      for (const a of toDelete) {
        await indexedDB.delete('it_assets', a.id);
      }
    }
    return await indexedDB.delete('departments', id);
  }

  // Update all references to a department when its name changes.
  // Scoped to a specific unit so same-named departments in other
  // units/offices are NOT touched.
  async updateDepartmentReferences(oldName, newName, unitScope) {
    const norm = (v) => (v || '').toString().trim().toLowerCase();
    const unitN = norm(unitScope);

    // Update IT assets (only within the same unit)
    const assets = await indexedDB.getAll('it_assets');
    const updatedAssets = assets.filter(asset =>
      asset.division === oldName && (!unitN || norm(asset.unit_office) === unitN)
    );
    for (const asset of updatedAssets) {
      asset.division = newName;
      await indexedDB.put('it_assets', asset);
    }

    // Update products (only within the same unit)
    const products = await indexedDB.getAll('products');
    const updatedProducts = products.filter(product =>
      product.department === oldName && (!unitN || norm(product.unit) === unitN)
    );
    for (const product of updatedProducts) {
      product.department = newName;
      await indexedDB.put('products', product);
    }
  }

  // Accessories CRUD
  async getAccessories() {
    return await indexedDB.getAll('accessories');
  }

  async addAccessory(accessory) {
    const newAccessory = {
      ...accessory,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return await indexedDB.add('accessories', newAccessory);
  }

  async updateAccessory(id, updates) {
    const accessory = await indexedDB.get('accessories', id);
    if (accessory) {
      const updatedAccessory = {
        ...accessory,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      return await indexedDB.put('accessories', updatedAccessory);
    }
    return null;
  }

  async deleteAccessory(id) {
    return await indexedDB.delete('accessories', id);
  }

  // IT Assets CRUD (for the comprehensive IT management table)
  async getITAssets() {
    return await indexedDB.getAll('it_assets');
  }

  async addITAsset(asset) {
    const newAsset = {
      ...asset,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-create department if it doesn't exist
    if (asset.division && asset.unit_office) {
      await this.autoCreateDepartment(asset.division, asset.unit_office);
    }

    // Auto-create user profile from IT Asset data
    if (asset.employee_name) {
      const users = await this.getUsers();
      const departments = await this.getDepartments();

      // Find the department ID — scoped to the asset's unit/office so
      // same-named departments in other units stay independent.
      const norm = (v) => (v || '').toString().trim().toLowerCase();
      const department = departments.find(dept =>
        norm(dept.name) === norm(asset.division) &&
        norm(dept.unit) === norm(asset.unit_office)
      );

      // Check if user already exists
      const existingUser = users.find(user =>
        user.name === asset.employee_name &&
        user.email === asset.email &&
        norm(user.unit_office || user.unit) === norm(asset.unit_office)
      );

      // Only create new user if doesn't exist
      if (!existingUser) {
        const newUser = {
          id: Date.now() + 1,
          name: asset.employee_name,
          designation: asset.designation,
          email: asset.email,
          phone: asset.mobile,
          department_id: department?.id.toString() || '1',
          unit_office: asset.unit_office,
          unit: asset.unit_office,
          antivirus_expiry: asset.antivirus_validity,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await indexedDB.add('users', newUser);
      }
    }

    return await indexedDB.add('it_assets', newAsset);
  }

  async updateITAsset(id, updates) {
    const asset = await indexedDB.get('it_assets', id);
    if (asset) {
      const updatedAsset = {
        ...asset,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      return await indexedDB.put('it_assets', updatedAsset);
    }
    return null;
  }

  async deleteITAsset(id) {
    const result = await indexedDB.delete('it_assets', id);
    await this.cleanupEmptyAssetHierarchy();
    return result;
  }

  async bulkDeleteITAssets(ids = []) {
    const cleanIds = (ids || []).filter((id) => id !== undefined && id !== null);
    if (cleanIds.length === 0) return true;
    const result = await indexedDB.bulkDelete('it_assets', cleanIds);
    await this.cleanupEmptyAssetHierarchy();
    return result;
  }

  async cleanupEmptyAssetHierarchy() {
    const norm = (v) => (v || '').toString().trim().toLowerCase();
    const [assets, departments, units] = await Promise.all([
      indexedDB.getAll('it_assets'),
      indexedDB.getAll('departments'),
      indexedDB.getAll('units'),
    ]);

    const hasAssetsForDept = (dept) => assets.some((asset) =>
      norm(asset.division) === norm(dept.name) &&
      (!dept.unit || norm(asset.unit_office) === norm(dept.unit))
    );

    const departmentsToDelete = departments.filter((dept) => !dept.scope && !hasAssetsForDept(dept));
    for (const dept of departmentsToDelete) {
      await indexedDB.delete('departments', dept.id);
    }

    const remainingDepartments = departments.filter((dept) =>
      !departmentsToDelete.some((deleted) => deleted.id === dept.id)
    );

    const unitsToDelete = units.filter((unit) =>
      !unit.scope &&
      !assets.some((asset) => norm(asset.unit_office) === norm(unit.name)) &&
      !remainingDepartments.some((dept) => !dept.scope && norm(dept.unit) === norm(unit.name))
    );

    for (const unit of unitsToDelete) {
      await indexedDB.delete('units', unit.id);
    }

    return { departmentsDeleted: departmentsToDelete.length, unitsDeleted: unitsToDelete.length };
  }

  // Utility methods
  async getExpiredAntivirusUsers() {
    const users = await this.getUsers();
    const assets = await this.getITAssets();
    const today = new Date();

    // Check both users and IT assets for expired antivirus
    const expiredUsers = users.filter(user => {
      if (user.antivirus_expiry) {
        const expiryDate = new Date(user.antivirus_expiry);
        return expiryDate < today;
      }
      return false;
    });

    const expiredAssets = assets.filter(asset => {
      if (asset.antivirus_validity) {
        const expiryDate = new Date(asset.antivirus_validity);
        return expiryDate < today;
      }
      return false;
    });

    return { users: expiredUsers, assets: expiredAssets };
  }

  async getDepartmentStats() {
    const users = await this.getUsers();
    const departments = await this.getDepartments();
    const assets = await this.getITAssets();

    const norm = (v) => (v || '').toString().trim().toLowerCase();

    return departments.map(dept => {
      const deptNameN = norm(dept.name);
      const deptUnitN = norm(dept.unit);
      // Strict unit isolation: match dept name AND unit_office (case-insensitive)
      const deptUsers = users.filter(user =>
        user.department_id === dept.id.toString() &&
        (!user.unit_office || norm(user.unit_office) === deptUnitN)
      );
      const deptAssets = assets.filter(asset =>
        norm(asset.division) === deptNameN &&
        norm(asset.unit_office) === deptUnitN
      );

      // Unique employees (skip blanks to avoid phantom count)
      const employeesFromAssets = deptAssets
        .map(a => norm(a.employee_name))
        .filter(Boolean);
      const employeesFromUsers = deptUsers
        .map(u => norm(u.name))
        .filter(Boolean);

      const uniqueEmployees = new Set([...employeesFromUsers, ...employeesFromAssets]);

      const expiredAntivirus = deptUsers.filter(user => {
        if (user.antivirus_expiry) {
          const expiryDate = new Date(user.antivirus_expiry);
          return expiryDate < new Date();
        }
        return false;
      });

      const expiredAssets = deptAssets.filter(asset => {
        if (asset.antivirus_validity) {
          const expiryDate = new Date(asset.antivirus_validity);
          return expiryDate < new Date();
        }
        return false;
      });

      return {
        ...dept,
        total_assets: deptAssets.length, // Assets count = total IT assets (matches IT Assets page)
        expired_antivirus: expiredAntivirus.length + expiredAssets.length,
        users: deptUsers,
        assets: deptAssets,
      };
    });
  }

  // Units CRUD
  async getUnits(scope) {
    const all = await indexedDB.getAll('units');
    if (scope === undefined) return all.filter(u => !u.scope);
    return all.filter(u => u.scope === scope);
  }

  async addUnit(unit) {
    const newUnit = {
      ...unit,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return await indexedDB.add('units', newUnit);
  }

  async updateUnit(id, updates) {
    const unit = await indexedDB.get('units', id);
    if (unit) {
      const oldName = unit.name;
      const updatedUnit = {
        ...unit,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await indexedDB.put('units', updatedUnit);

      // Cascade name change globally only for non-scoped (dashboard) units.
      if (updates.name && updates.name !== oldName && !unit.scope) {
        const newName = updates.name;

        const departments = await indexedDB.getAll('departments');
        for (const d of departments.filter(d => d.unit === oldName)) {
          await indexedDB.put('departments', { ...d, unit: newName });
        }

        const assets = await indexedDB.getAll('it_assets');
        for (const a of assets.filter(a => a.unit_office === oldName)) {
          await indexedDB.put('it_assets', { ...a, unit_office: newName });
        }

        const users = await indexedDB.getAll('users');
        for (const u of users.filter(u => u.unit === oldName)) {
          await indexedDB.put('users', { ...u, unit: newName });
        }

        const products = await indexedDB.getAll('products');
        for (const p of products.filter(p => p.unit === oldName)) {
          await indexedDB.put('products', { ...p, unit: newName });
        }
      }

      return updatedUnit;
    }
    return null;
  }

  async deleteUnit(id) {
    const unit = await indexedDB.get('units', id);
    if (unit && !unit.scope) {
      const norm = (v) => (v || '').toString().trim().toLowerCase();
      // Cascade delete IT assets belonging to this unit/office
      const assets = await indexedDB.getAll('it_assets');
      for (const a of assets.filter(a => norm(a.unit_office) === norm(unit.name))) {
        await indexedDB.delete('it_assets', a.id);
      }
      // Cascade delete departments belonging to this unit
      const departments = await indexedDB.getAll('departments');
      for (const d of departments.filter(d => !d.scope && norm(d.unit) === norm(unit.name))) {
        await indexedDB.delete('departments', d.id);
      }
    }
    return await indexedDB.delete('units', id);
  }

  // Products CRUD
  async getProducts() {
    return await indexedDB.getAll('products');
  }

  async addProduct(product) {
    const newProduct = {
      ...product,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-create department if it doesn't exist
    if (product.department && product.unit) {
      await this.autoCreateDepartment(product.department, product.unit);
    }

    return await indexedDB.add('products', newProduct);
  }

  async updateProduct(id, updates) {
    const product = await indexedDB.get('products', id);
    if (product) {
      const updatedProduct = {
        ...product,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      return await indexedDB.put('products', updatedProduct);
    }
    return null;
  }

  async deleteProduct(id) {
    return await indexedDB.delete('products', id);
  }

  // Search and Filter methods
  async searchProducts(query, filters = {}) {
    const products = await this.getProducts();
    let filtered = products;

    // Apply text search
    if (query) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchTerm) ||
        product.category?.toLowerCase().includes(searchTerm) ||
        product.brand?.toLowerCase().includes(searchTerm) ||
        product.serial?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply filters
    if (filters.unit) {
      filtered = filtered.filter(product => product.unit === filters.unit);
    }
    if (filters.category) {
      filtered = filtered.filter(product => product.category === filters.category);
    }
    if (filters.status) {
      filtered = filtered.filter(product => product.status === filters.status);
    }

    return filtered;
  }

  async getFilteredAssets(type) {
    const assets = await this.getITAssets();
    switch (type) {
      case 'laptops':
        return assets.filter(asset => asset.device_type?.toLowerCase() === 'laptop');
      case 'desktops':
        return assets.filter(asset => asset.device_type?.toLowerCase() === 'desktop');
      case 'expired':
        return assets.filter(asset => {
          if (asset.antivirus_validity) {
            const expiryDate = new Date(asset.antivirus_validity);
            return expiryDate < new Date();
          }
          return false;
        });
      default:
        return assets;
    }
  }

  async getUnitStats() {
    const units = await this.getUnits();
    const departments = await this.getDepartments();
    const users = await this.getUsers();
    const assets = await this.getITAssets();
    const products = await this.getProducts();

    const norm = (v) => (v || '').toString().trim().toLowerCase();

    return units
      .slice()
      .sort((a, b) => (a.name || '').localeCompare((b.name || ''), undefined, { numeric: true, sensitivity: 'base' }))
      .map(unit => {
        const unitN = norm(unit.name);
        const unitDepartments = departments.filter(dept => norm(dept.unit) === unitN);
        const unitAssets = assets.filter(asset => norm(asset.unit_office) === unitN);
        const unitUsers = users.filter(user => {
          const userDept = departments.find(dept => dept.id.toString() === user.department_id);
          return userDept && norm(userDept.unit) === unitN;
        });
        const unitProducts = products.filter(product => norm(product.unit) === unitN);

        const employeesFromUnitAssets = unitAssets
          .map(a => norm(a.employee_name))
          .filter(Boolean);
        const employeesFromUnitUsers = unitUsers
          .map(u => norm(u.name))
          .filter(Boolean);

        const uniqueUnitEmployees = new Set([...employeesFromUnitUsers, ...employeesFromUnitAssets]);

        return {
          ...unit,
          total_departments: unitDepartments.length,
          total_assets: unitAssets.length, // Assets count = total IT assets (matches IT Assets page)
          total_products: unitProducts.length,
          departments: unitDepartments.map(dept => {
            const deptNameN = norm(dept.name);
            const deptUsers = unitUsers.filter(user => user.department_id === dept.id.toString());
            const deptAssets = unitAssets.filter(asset => norm(asset.division) === deptNameN);

            const employeesFromDeptAssets = deptAssets
              .map(a => norm(a.employee_name))
              .filter(Boolean);
            const employeesFromDeptUsers = deptUsers
              .map(u => norm(u.name))
              .filter(Boolean);

            const uniqueDeptEmployees = new Set([...employeesFromDeptUsers, ...employeesFromDeptAssets]);

            const expiredAntivirus = deptUsers.filter(user => {
              if (user.antivirus_expiry) {
                const expiryDate = new Date(user.antivirus_expiry);
                return expiryDate < new Date();
              }
              return false;
            });

            const expiredAssets = deptAssets.filter(asset => {
              if (asset.antivirus_validity) {
                const expiryDate = new Date(asset.antivirus_validity);
                return expiryDate < new Date();
              }
              return false;
            });

            return {
              ...dept,
              total_users: uniqueDeptEmployees.size,
              total_assets: deptAssets.length,
              expired_antivirus: expiredAntivirus.length + expiredAssets.length,
              users: deptUsers,
              assets: deptAssets,
            };
          }),
          users: unitUsers,
          assets: unitAssets,
          products: unitProducts
        };
      });
  }

  // Auto-create department if it doesn't exist
  async autoCreateDepartment(departmentName, unitName) {
    const departments = await this.getDepartments();
    const existingDept = departments.find(dept =>
      dept.name === departmentName && dept.unit === unitName
    );

    if (!existingDept) {
      const newDepartment = {
        id: Date.now(),
        name: departmentName,
        unit: unitName,
        created_at: new Date().toISOString()
      };
      await indexedDB.add('departments', newDepartment);
    }
  }

  // Filter assets by type with enhanced filtering
  async getFilteredAssetsByCategory(category) {
    const assets = await this.getITAssets();
    switch (category) {
      case 'laptops':
        return assets.filter(asset => asset.device_type === 'laptop');
      case 'desktops':
        return assets.filter(asset => asset.device_type === 'desktop');
      case 'in_repair':
        return assets.filter(asset => asset.remarks?.toLowerCase().includes('repair') ||
          asset.remarks?.toLowerCase().includes('faulty'));
      case 'active':
        return assets.filter(asset => !asset.remarks?.toLowerCase().includes('repair') &&
          !asset.remarks?.toLowerCase().includes('faulty') &&
          !asset.remarks?.toLowerCase().includes('inactive'));
      case 'expired_antivirus':
        const expired = await this.getExpiredAntivirusUsers();
        return expired.assets;
      default:
        return assets;
    }
  }

  // User Activity Tracking
  async addUserActivity(userId, activity) {
    const activities = await indexedDB.getAll('user_activities');
    const newActivity = {
      id: Date.now(),
      user_id: userId,
      ...activity,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString()
    };
    await indexedDB.add('user_activities', newActivity);
    return newActivity;
  }

  async getUserActivities(userId) {
    const activities = await indexedDB.getAll('user_activities');
    return activities.filter(activity => activity.user_id === userId);
  }

  async updateUserActivity(id, updates) {
    const activity = await indexedDB.get('user_activities', id);
    if (activity) {
      const updatedActivity = { ...activity, ...updates };
      return await indexedDB.put('user_activities', updatedActivity);
    }
    return null;
  }

  async deleteUserActivity(id) {
    return await indexedDB.delete('user_activities', id);
  }

  async getRecentActivities() {
    const activities = await indexedDB.getAll('user_activities');
    const today = new Date().toLocaleDateString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString();

    return {
      today: activities.filter(activity => activity.date === today),
      tomorrow: activities.filter(activity => activity.date === tomorrow),
      recent: activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10)
    };
  }

  async getUserStats(userId) {
    const activities = await this.getUserActivities(userId);
    const accessories = await this.getAccessories();
    const userAccessories = accessories.filter(acc => acc.user_id === userId);

    const stats = {
      mouse: activities.filter(a => a.type === 'mouse').length,
      keyboard: activities.filter(a => a.type === 'keyboard').length,
      antivirus: activities.filter(a => a.type === 'antivirus').length,
      battery: activities.filter(a => a.type === 'battery').length,
      laptop_exchanges: activities.filter(a => a.type === 'laptop_exchange').length,
      pc_exchanges: activities.filter(a => a.type === 'pc_exchange').length,
      total_accessories: userAccessories.length,
      total_activities: activities.length
    };

    return stats;
  }

  // Schedule Management
  async getSchedules() {
    return await indexedDB.getAll('schedules');
  }

  async getTomorrowSchedules() {
    const schedules = await this.getSchedules();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString();
    return schedules.filter(schedule => schedule.date === tomorrow);
  }

  async addSchedule(schedule) {
    const newSchedule = {
      id: Date.now(),
      ...schedule,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return await indexedDB.add('schedules', newSchedule);
  }

  async updateSchedule(id, updates) {
    const schedule = await indexedDB.get('schedules', id);
    if (schedule) {
      const updatedSchedule = {
        ...schedule,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      return await indexedDB.put('schedules', updatedSchedule);
    }
    return null;
  }

  async deleteSchedule(id) {
    return await indexedDB.delete('schedules', id);
  }

  async clearAllData() {
    // Clear ALL persisted data (IndexedDB + localStorage)
    const stores = [
      'users',
      'departments',
      'accessories',
      'it_assets',
      'units',
      'products',
      'user_activities',
      'printers',
      'ip_phones',
      'wifi_networks',
      'ip_addresses',
      'cctv_cameras',
      'nvrs',
      'cctv_checklists',
      'schedules',
    ];

    // 1) Clear localStorage first so migration can't restore old data
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('mnr_') || key.startsWith('cctv_')) {
        localStorage.removeItem(key);
      }
    });

    // 2) Clear object stores (best-effort)
    for (const store of stores) {
      try {
        await indexedDB.clear(store);
      } catch {
        // ignore
      }
    }

    // 3) Hard reset IndexedDB database
    await indexedDB.deleteDatabase();

    // 4) Re-init to recreate required stores + default baseline data
    await this.initializeData();

    return true;
  }

  // Export data to JSON format - includes ALL data
  async exportData() {
    const data = {
      users: await this.getUsers(),
      departments: await this.getDepartments(),
      assets: await this.getITAssets(),
      units: await this.getUnits(),
      products: await this.getProducts(),
      activities: await indexedDB.getAll('user_activities'),
      printers: await this.getPrinters(),
      ip_phones: await this.getIPPhones(),
      wifi_networks: await this.getWifiNetworks(),
      ip_addresses: await this.getIPAddresses(),
      cctv_cameras: await this.getCCTVCameras(),
      nvrs: await this.getNVRs(),
      cctv_checklists: await this.getCCTVChecklists(),
      exportDate: new Date().toISOString()
    };
    return data;
  }

  // Import data from JSON format - includes ALL data
  async importData(data) {
    try {
      if (data.users) await indexedDB.bulkPut('users', data.users);
      if (data.departments) await indexedDB.bulkPut('departments', data.departments);
      if (data.assets) await indexedDB.bulkPut('it_assets', data.assets);
      if (data.units) await indexedDB.bulkPut('units', data.units);
      if (data.products) await indexedDB.bulkPut('products', data.products);
      if (data.activities) await indexedDB.bulkPut('user_activities', data.activities);
      if (data.printers) await indexedDB.bulkPut('printers', data.printers);
      if (data.ip_phones) await indexedDB.bulkPut('ip_phones', data.ip_phones);
      if (data.wifi_networks) await indexedDB.bulkPut('wifi_networks', data.wifi_networks);
      if (data.ip_addresses) await indexedDB.bulkPut('ip_addresses', data.ip_addresses);
      if (data.cctv_cameras) await indexedDB.bulkPut('cctv_cameras', data.cctv_cameras);
      if (data.nvrs) await indexedDB.bulkPut('nvrs', data.nvrs);
      if (data.cctv_checklists) await indexedDB.bulkPut('cctv_checklists', data.cctv_checklists);
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }

  // Printers CRUD
  async getPrinters() {
    return await cloudGetAll('printers');
  }

  async addPrinter(printer) {
    return await cloudInsert('printers', { ...printer, added_date: new Date().toISOString() });
  }

  async updatePrinter(id, updates) {
    return await cloudUpdate('printers', id, updates);
  }

  async deletePrinter(id) {
    return await cloudDelete('printers', id);
  }

  // IP Phones CRUD
  async getIPPhones() {
    const phones = await indexedDB.getAll('ip_phones');
    // Auto-generate SL numbers
    return phones.map((phone, index) => ({
      ...phone,
      sl_no: index + 1
    }));
  }

  async addIPPhone(phone) {
    const newPhone = {
      ...phone,
      id: Date.now(),
      added_date: new Date().toISOString(),
    };
    return await indexedDB.add('ip_phones', newPhone);
  }

  async updateIPPhone(id, updates) {
    const phone = await indexedDB.get('ip_phones', id);
    if (phone) {
      const updatedPhone = { ...phone, ...updates };
      return await indexedDB.put('ip_phones', updatedPhone);
    }
    return null;
  }

  async deleteIPPhone(id) {
    return await indexedDB.delete('ip_phones', id);
  }

  // WiFi Networks CRUD
  async getWifiNetworks() {
    return await cloudGetAll('wifi_networks');
  }

  async addWifiNetwork(wifi) {
    return await cloudInsert('wifi_networks', { ...wifi, added_date: new Date().toISOString() });
  }

  async updateWifiNetwork(id, updates) {
    return await cloudUpdate('wifi_networks', id, updates);
  }

  async deleteWifiNetwork(id) {
    return await cloudDelete('wifi_networks', id);
  }

  // IP Addresses CRUD
  async getIPAddresses() {
    return await cloudGetAll('ip_addresses');
  }

  async addIPAddress(ipAddress) {
    return await cloudInsert('ip_addresses', { ...ipAddress, added_date: new Date().toISOString() });
  }

  async updateIPAddress(id, updates) {
    return await cloudUpdate('ip_addresses', id, updates);
  }

  async deleteIPAddress(id) {
    return await cloudDelete('ip_addresses', id);
  }

  // CCTV Cameras CRUD
  async getCCTVCameras() {
    return await indexedDB.getAll('cctv_cameras');
  }

  async addCCTVCamera(camera) {
    const newCamera = {
      ...camera,
      id: Date.now(),
      added_date: new Date().toISOString(),
    };
    return await indexedDB.add('cctv_cameras', newCamera);
  }

  async updateCCTVCamera(id, updates) {
    const camera = await indexedDB.get('cctv_cameras', id);
    if (camera) {
      const updatedCamera = { ...camera, ...updates };
      return await indexedDB.put('cctv_cameras', updatedCamera);
    }
    return null;
  }

  async deleteCCTVCamera(id) {
    return await indexedDB.delete('cctv_cameras', id);
  }

  // Import helpers — preserve incoming ids and upsert (no duplicate-id crashes)
  async upsertCCTVCamera(camera) {
    const row = { ...camera, id: camera?.id ?? `cam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
    return await indexedDB.put('cctv_cameras', row);
  }

  async upsertNVR(nvr) {
    const row = { ...nvr, id: nvr?.id ?? `nvr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
    return await indexedDB.put('nvrs', row);
  }

  async upsertCCTVChecklist(checklist) {
    const row = { ...checklist, id: checklist?.id ?? `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
    return await indexedDB.put('cctv_checklists', row);
  }

  // NVR CRUD
  async getNVRs() {
    return await indexedDB.getAll('nvrs');
  }

  async addNVR(nvr) {
    const newNVR = {
      ...nvr,
      id: Date.now(),
      created_at: new Date().toISOString(),
    };
    return await indexedDB.add('nvrs', newNVR);
  }

  async updateNVR(id, updates) {
    const nvr = await indexedDB.get('nvrs', id);
    if (nvr) {
      const updatedNVR = { ...nvr, ...updates };
      return await indexedDB.put('nvrs', updatedNVR);
    }
    return null;
  }

  async deleteNVR(id) {
    return await indexedDB.delete('nvrs', id);
  }

  // CCTV Checklists CRUD
  async getCCTVChecklists() {
    return await indexedDB.getAll('cctv_checklists');
  }

  async addCCTVChecklist(checklist) {
    const dateValue = String(checklist.date || "").trim();
    const existingChecklists = await this.getCCTVChecklists();
    const duplicate = existingChecklists.find(
      (c) => c.nvr_id === checklist.nvr_id && String(c.date || "").trim() === dateValue
    );
    if (duplicate) {
      throw new Error(
        `Checklist for NVR-${checklist.nvr_id} on ${dateValue} already exists.`
      );
    }

    const newChecklist = {
      ...checklist,
      date: dateValue,
      id: Date.now(),
      created_at: new Date().toISOString(),
    };
    return await indexedDB.add('cctv_checklists', newChecklist);
  }

  async updateCCTVChecklist(id, updates) {
    const checklist = await indexedDB.get('cctv_checklists', id);
    if (checklist) {
      const updatedChecklist = { ...checklist, ...updates };
      return await indexedDB.put('cctv_checklists', updatedChecklist);
    }
    return null;
  }

  async deleteCCTVChecklist(id) {
    return await indexedDB.delete('cctv_checklists', id);
  }
}

export default new DBService();
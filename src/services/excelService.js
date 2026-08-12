// Excel import/export service for MNR IT Management System

class ExcelService {
  // Export users to CSV format
  exportUsers(users, departments) {
    const headers = [
      'ID', 'Name', 'Email', 'Department', 'Position', 
      'Antivirus Status', 'Antivirus Expiry', 'Mouse Battery', 
      'Created At', 'Updated At'
    ];
    
    const rows = users.map(user => {
      const department = departments.find(d => d.id === user.department_id);
      return [
        user.id,
        user.name,
        user.email,
        department?.name || 'N/A',
        user.position || 'N/A',
        user.antivirus_status || 'N/A',
        user.antivirus_expiry || 'N/A',
        user.mouse_battery || 'N/A',
        user.created_at,
        user.updated_at
      ];
    });

    return this.arrayToCSV([headers, ...rows]);
  }

  // Export departments to CSV format
  exportDepartments(departments) {
    const headers = ['ID', 'Name', 'Created At', 'Updated At'];
    
    const rows = departments.map(dept => [
      dept.id,
      dept.name,
      dept.created_at,
      dept.updated_at
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  // Export accessories to CSV format
  exportAccessories(accessories, users) {
    const headers = [
      'ID', 'User', 'Type', 'Brand', 'Model', 'Status', 
      'Issue Date', 'Replacement Date', 'Created At', 'Updated At'
    ];
    
    const rows = accessories.map(acc => {
      const user = users.find(u => u.id === acc.user_id);
      return [
        acc.id,
        user?.name || 'N/A',
        acc.type,
        acc.brand || 'N/A',
        acc.model || 'N/A',
        acc.status,
        acc.issue_date || 'N/A',
        acc.replacement_date || 'N/A',
        acc.created_at,
        acc.updated_at
      ];
    });

    return this.arrayToCSV([headers, ...rows]);
  }

  // Convert array to CSV string
  arrayToCSV(data) {
    return data.map(row => 
      row.map(field => {
        // Escape quotes and wrap in quotes if contains comma or quote
        const stringField = String(field || '');
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return '"' + stringField.replace(/"/g, '""') + '"';
        }
        return stringField;
      }).join(',')
    ).join('\n');
  }

  // Download CSV file
  downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Parse CSV string to array
  parseCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const row = this.parseCSVRow(line);
        result.push(row);
      }
    }
    
    return result;
  }

  // Parse a single CSV row
  parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  // Import users from CSV
  importUsers(csvText) {
    const data = this.parseCSV(csvText);
    if (data.length < 2) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return rows.map(row => {
      const user = {};
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/\s+/g, '_');
        user[key] = row[index] || '';
      });
      return user;
    });
  }

  // Import departments from CSV
  importDepartments(csvText) {
    const data = this.parseCSV(csvText);
    if (data.length < 2) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return rows.map(row => {
      const department = {};
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/\s+/g, '_');
        department[key] = row[index] || '';
      });
      return department;
    });
  }
}

export default new ExcelService();
import { useEffect, useState } from "react";
import UnitsOfficesManager from "@/components/UnitsOfficesManager";
import dbService from "@/services/dbService";
import { useCloudRealtime } from "@/hooks/useCloudRealtime";

const Departments = () => {
  const [units, setUnits] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useCloudRealtime(["units_cloud", "departments_cloud"], () => { loadData(); });

  const loadData = async () => {
    const unitsData = await dbService.getUnitStats();
    const departmentStatsData = await dbService.getDepartmentStats();
    setUnits(unitsData);
    setDepartments(departmentStatsData);

    // Refresh selectedUnit / selectedDepartment with fresh data so newly
    // added/edited departments show up without a manual refresh.
    setSelectedUnit((prev) =>
      prev ? unitsData.find((u) => u.id === prev.id) || null : prev
    );
    setSelectedDepartment((prev) =>
      prev ? departmentStatsData.find((d) => d.id === prev.id) || null : prev
    );
  };

  const handleUnitClick = (unit) => {
    setSelectedUnit(unit);
    setSelectedDepartment(null);
  };

  const handleDepartmentClick = (department) => {
    setSelectedDepartment(department);
  };

  const handleBackToUnits = () => {
    setSelectedUnit(null);
    setSelectedDepartment(null);
  };

  const handleBackToDepartments = () => {
    setSelectedDepartment(null);
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 min-h-screen">
      <UnitsOfficesManager
        units={units}
        departments={departments}
        selectedUnit={selectedUnit}
        selectedDepartment={selectedDepartment}
        onUnitClick={handleUnitClick}
        onDepartmentClick={handleDepartmentClick}
        onBackToUnits={handleBackToUnits}
        onBackToDepartments={handleBackToDepartments}
        onDataChange={loadData}
      />
    </div>
  );
};

export default Departments;
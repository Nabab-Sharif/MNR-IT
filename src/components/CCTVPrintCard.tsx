import { forwardRef } from "react";

interface CCTVCamera {
  id: number;
  serial_number: string;
  camera_name: string;
  location: string;
  unit_number: string;
  department_name: string;
  status: string;
  issues?: Array<{
    date: string;
    description: string;
    resolved: boolean;
  }>;
}

interface CCTVPrintCardProps {
  cameras: CCTVCamera[];
}

const CCTVPrintCard = forwardRef<HTMLDivElement, CCTVPrintCardProps>(
  ({ cameras }, ref) => {
    const currentDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Group cameras by unit and department
    const groupedCameras: { [unit: string]: { [dept: string]: CCTVCamera[] } } = {};
    cameras.forEach((camera) => {
      if (!groupedCameras[camera.unit_number]) {
        groupedCameras[camera.unit_number] = {};
      }
      if (!groupedCameras[camera.unit_number][camera.department_name]) {
        groupedCameras[camera.unit_number][camera.department_name] = [];
      }
      groupedCameras[camera.unit_number][camera.department_name].push(camera);
    });

    const checklistItems = [
      "All cameras are powered on and operational",
      "DVR/NVR system is recording properly",
      "All camera lenses are clean",
      "Night vision is working correctly",
      "Motion detection is properly configured",
      "Storage space is adequate for recordings",
      "All cables and connections are secure",
      "Backup power system is functional",
    ];

    return (
      <div ref={ref} className="hidden print:block cctv-print-layout">
        {/* Print Header */}
        <div className="cctv-print-header">
          <div className="flex items-center justify-center gap-4 mb-2">
            <img
              src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png"
              alt="MNR Group Logo"
              className="w-20 h-20 object-contain"
            />
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white">MNR Sweaters Ltd</h1>
              <h2 className="text-xl text-white/90 mt-1">CCTV Check List</h2>
            </div>
          </div>
          <p className="text-center text-white/80 text-sm">Date: {currentDate}</p>
        </div>

        {/* Checklist Section */}
        <div className="cctv-print-section mt-6">
          <h3 className="cctv-print-section-title">Daily Check Requirements</h3>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {checklistItems.map((item, index) => (
              <div key={index} className="cctv-checklist-item flex items-center gap-2">
                <div className="cctv-checkbox"></div>
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Camera List by Unit/Department */}
        {Object.entries(groupedCameras).map(([unitName, departments]) => (
          <div key={unitName} className="cctv-print-section mt-6 page-break-inside-avoid">
            <h3 className="cctv-print-section-title">{unitName}</h3>
            
            {Object.entries(departments).map(([deptName, deptCameras]) => (
              <div key={deptName} className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded">{deptName}</span>
                  <span className="text-xs text-gray-400">({deptCameras.length} cameras)</span>
                </h4>
                
                <table className="cctv-print-table w-full">
                  <thead>
                    <tr>
                      <th>SL</th>
                      <th>Serial Number</th>
                      <th>Camera Name</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Check</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptCameras.map((camera, index) => {
                      const hasIssues = camera.issues?.some(i => !i.resolved);
                      return (
                        <tr key={camera.id} className={hasIssues ? 'issue-row' : ''}>
                          <td>{index + 1}</td>
                          <td className="font-mono text-xs">{camera.serial_number}</td>
                          <td className="font-medium">{camera.camera_name}</td>
                          <td>{camera.location}</td>
                          <td>
                            <span className={`status-badge ${camera.status === 'active' ? 'active' : 'inactive'}`}>
                              {camera.status}
                            </span>
                          </td>
                          <td>
                            <div className="cctv-checkbox-cell"></div>
                          </td>
                          <td className="remarks-cell"></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))}

        {/* Issues Section */}
        <div className="cctv-print-section mt-6 page-break-inside-avoid">
          <h3 className="cctv-print-section-title">Issue Log</h3>
          <table className="cctv-print-table w-full mt-4">
            <thead>
              <tr>
                <th>Date</th>
                <th>Camera</th>
                <th>Location</th>
                <th>Issue Description</th>
                <th>Status</th>
                <th>Resolved By</th>
              </tr>
            </thead>
            <tbody>
              {cameras.flatMap(camera =>
                (camera.issues || []).map((issue, idx) => (
                  <tr key={`${camera.id}-${idx}`} className={issue.resolved ? '' : 'issue-row'}>
                    <td>{issue.date}</td>
                    <td className="font-medium">{camera.camera_name}</td>
                    <td>{camera.location}</td>
                    <td>{issue.description}</td>
                    <td>
                      <span className={`status-badge ${issue.resolved ? 'resolved' : 'pending'}`}>
                        {issue.resolved ? 'Resolved' : 'Pending'}
                      </span>
                    </td>
                    <td className="resolved-by-cell"></td>
                  </tr>
                ))
              )}
              {cameras.every(c => !c.issues?.length) && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-4">
                    No issues recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Signature Section */}
        <div className="cctv-print-signatures mt-8">
          <div className="grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="signature-line"></div>
              <p className="text-sm font-medium">Checked By</p>
              <p className="text-xs text-gray-500">Security Officer</p>
            </div>
            <div className="text-center">
              <div className="signature-line"></div>
              <p className="text-sm font-medium">Verified By</p>
              <p className="text-xs text-gray-500">IT Department</p>
            </div>
            <div className="text-center">
              <div className="signature-line"></div>
              <p className="text-sm font-medium">Approved By</p>
              <p className="text-xs text-gray-500">Management</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cctv-print-footer mt-8">
          <p>Created by IT Team - MNR Group</p>
          <p className="text-sm opacity-80">
            Printed on: {currentDate} at {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  }
);

CCTVPrintCard.displayName = "CCTVPrintCard";

export default CCTVPrintCard;

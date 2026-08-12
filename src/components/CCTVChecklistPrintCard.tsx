import React from 'react';

interface NVRCamera {
  id: number;
  camera_id: string;
  location_name: string;
  camera_position: string;
  camera_recordings: string;
  clear_vision: string;
  remarks: string;
}

interface CCTVChecklistPrintCardProps {
  nvrNumber: string;
  date: string;
  cameras: NVRCamera[];
  checkedBy: string;
  verifiedBy: string;
  approvedBy: string;
}

const CCTVChecklistPrintCard: React.FC<CCTVChecklistPrintCardProps> = ({
  nvrNumber,
  date,
  cameras,
  checkedBy,
  verifiedBy,
  approvedBy,
}) => {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "8mm 10mm",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        background: "#fff",
        pageBreakAfter: "always",
      }}
    >
      {/* Header with Logo */}
      <div style={{ textAlign: "center" as const, marginBottom: "8px" }}>
        <img 
          src="/pictures/a036b691-f157-44ee-9c7c-6c641ef0b004.png" 
          alt="MNR Logo" 
          style={{ height: "40px", marginBottom: "4px" }}
        />
        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1a365d" }}>
          MNR Sweaters Ltd.
        </div>
        <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "4px" }}>
          Daily Camera Check & Maintenance Report
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontWeight: "bold" }}>
          <span>NVR-{nvrNumber}</span>
          <span>Date: {formatDate(date)}</span>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ border: "1px solid #000", padding: "4px", width: "25px", textAlign: "center" as const, fontWeight: "bold" }}>SL</th>
            <th style={{ border: "1px solid #000", padding: "4px", width: "50px", textAlign: "center" as const, fontWeight: "bold" }}>Camera ID</th>
            <th style={{ border: "1px solid #000", padding: "4px", textAlign: "left" as const, fontWeight: "bold" }}>Location Name</th>
            <th style={{ border: "1px solid #000", padding: "4px", width: "50px", textAlign: "center" as const, fontWeight: "bold" }}>Camera Position</th>
            <th style={{ border: "1px solid #000", padding: "4px", width: "55px", textAlign: "center" as const, fontWeight: "bold" }}>Camera Recordings</th>
            <th style={{ border: "1px solid #000", padding: "4px", width: "45px", textAlign: "center" as const, fontWeight: "bold" }}>Clear Vision</th>
            <th style={{ border: "1px solid #000", padding: "4px", width: "100px", textAlign: "center" as const, fontWeight: "bold" }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {cameras.map((camera, index) => (
            <tr key={index}>
              <td style={{ border: "1px solid #000", padding: "3px", textAlign: "center" as const, verticalAlign: "middle" as const }}>{index + 1}</td>
              <td style={{ border: "1px solid #000", padding: "3px", textAlign: "center" as const, verticalAlign: "middle" as const, fontWeight: "bold" }}>{camera.camera_id}</td>
              <td style={{ border: "1px solid #000", padding: "3px", textAlign: "left" as const, verticalAlign: "middle" as const }}>{camera.location_name || "-"}</td>
              <td style={{ border: "1px solid #000", padding: "3px", textAlign: "center" as const, verticalAlign: "middle" as const }}>{camera.camera_position}</td>
              <td style={{ border: "1px solid #000", padding: "3px", textAlign: "center" as const, verticalAlign: "middle" as const }}>{camera.camera_recordings}</td>
              <td style={{ border: "1px solid #000", padding: "3px", textAlign: "center" as const, verticalAlign: "middle" as const }}>{camera.clear_vision}</td>
              <td style={{ border: "1px solid #000", padding: "3px", textAlign: "left" as const, verticalAlign: "middle" as const, wordBreak: "break-word" as const }}>{camera.remarks || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer Signatures */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "16px",
          paddingTop: "8px",
        }}
      >
        <div style={{ textAlign: "center" as const }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: "4px", minWidth: "120px" }}>
            {checkedBy}
          </div>
        </div>
        <div style={{ textAlign: "center" as const }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: "4px", minWidth: "120px" }}>
            {verifiedBy}
          </div>
        </div>
        <div style={{ textAlign: "center" as const }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: "4px", minWidth: "120px" }}>
            {approvedBy}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CCTVChecklistPrintCard;

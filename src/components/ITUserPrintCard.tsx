import { forwardRef } from "react";

interface ITUserPrintCardProps {
  user: {
    picture?: string;
    employee_name: string;
    designation?: string;
    email?: string;
    mobile?: string;
    division?: string;
    unit_office?: string;
    pc_no?: string;
    sl_no?: string;
    device_type?: string;
    specification?: string;
    ip_no?: string;
    windows_version?: string;
    antivirus_code?: string;
    antivirus_validity?: string;
    ultraview_id?: string;
    anydesk_id?: string;
    printer?: string;
    scanner?: string;
    boot_partition?: string;
    remarks?: string;
    peripherals?: Array<{
      product_type: string;
      quantity: number;
      exchange_date?: string;
    }>;
  };
}

const ITUserPrintCard = forwardRef<HTMLDivElement, ITUserPrintCardProps>(
  ({ user }, ref) => {
    const getWindowsLabel = (value: string) => {
      const labels: { [key: string]: string } = {
        windows_10_pro: "Windows 10 Pro",
        windows_11_pro: "Windows 11 Pro",
        windows_10_enterprise: "Windows 10 Enterprise",
        windows_server_2019: "Windows Server 2019 Standard",
        windows_10_iot: "Windows 10 IoT Enterprise",
      };
      return labels[value] || value;
    };

    return (
      <div ref={ref} className="hidden print:block it-user-print-layout">
        {/* Print Header */}
        <div className="it-user-print-header">
          <div className="flex items-center justify-center gap-4">
            <img
              src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png"
              alt="MNR Group Logo"
              className="w-16 h-16 object-contain"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">MNR Group</h1>
              <p className="text-sm text-white/90">IT Asset Profile</p>
            </div>
          </div>
        </div>

        {/* User Picture & Name */}
        <div className="text-center mt-6 mb-6">
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.employee_name}
              className="it-user-print-picture"
            />
          ) : (
            <div className="it-user-print-picture-placeholder">
              {user.employee_name?.charAt(0) || "U"}
            </div>
          )}
          <h2 className="text-xl font-bold text-sky-700 mt-4">{user.employee_name}</h2>
          <p className="text-gray-600">{user.designation}</p>
        </div>

        {/* Personal Information */}
        <div className="it-user-print-section">
          <h3 className="it-user-print-section-title">Personal Information</h3>
          <div className="it-user-print-grid">
            <div className="it-user-print-item">
              <span className="it-user-print-label">Email</span>
              <span className="it-user-print-value">{user.email || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Mobile</span>
              <span className="it-user-print-value">{user.mobile || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Department</span>
              <span className="it-user-print-value">{user.division || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Unit/Office</span>
              <span className="it-user-print-value">{user.unit_office || "-"}</span>
            </div>
          </div>
        </div>

        {/* Device Information */}
        <div className="it-user-print-section">
          <h3 className="it-user-print-section-title">Device Information</h3>
          <div className="it-user-print-grid">
            <div className="it-user-print-item">
              <span className="it-user-print-label">PC No</span>
              <span className="it-user-print-value">{user.pc_no || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Serial No</span>
              <span className="it-user-print-value">{user.sl_no || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Device Type</span>
              <span className="it-user-print-value capitalize">{user.device_type || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Specification</span>
              <span className="it-user-print-value">{user.specification || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">IP Address</span>
              <span className="it-user-print-value">{user.ip_no || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Windows Version</span>
              <span className="it-user-print-value">
                {user.windows_version ? getWindowsLabel(user.windows_version) : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Remote Access */}
        <div className="it-user-print-section">
          <h3 className="it-user-print-section-title">Remote Access</h3>
          <div className="it-user-print-grid">
            <div className="it-user-print-item">
              <span className="it-user-print-label">UltraViewer ID</span>
              <span className="it-user-print-value">{user.ultraview_id || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">AnyDesk ID</span>
              <span className="it-user-print-value">{user.anydesk_id || "-"}</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="it-user-print-section">
          <h3 className="it-user-print-section-title">Security</h3>
          <div className="it-user-print-grid">
            <div className="it-user-print-item">
              <span className="it-user-print-label">Antivirus Code</span>
              <span className="it-user-print-value">{user.antivirus_code || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Antivirus Validity</span>
              <span className="it-user-print-value">
                {user.antivirus_validity
                  ? new Date(user.antivirus_validity).toLocaleDateString()
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Hardware */}
        <div className="it-user-print-section">
          <h3 className="it-user-print-section-title">Hardware</h3>
          <div className="it-user-print-grid">
            <div className="it-user-print-item">
              <span className="it-user-print-label">Printer</span>
              <span className="it-user-print-value">{user.printer || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Scanner</span>
              <span className="it-user-print-value">{user.scanner || "-"}</span>
            </div>
            <div className="it-user-print-item">
              <span className="it-user-print-label">Boot Partition</span>
              <span className="it-user-print-value">{user.boot_partition || "-"}</span>
            </div>
          </div>
        </div>

        {/* Peripherals */}
        {user.peripherals && user.peripherals.length > 0 && (
          <div className="it-user-print-section">
            <h3 className="it-user-print-section-title">Peripherals</h3>
            <div className="it-user-print-peripherals-grid">
              {user.peripherals.map((peripheral, index) => (
                <div key={index} className="it-user-print-peripheral-item">
                  <span className="font-semibold">{peripheral.product_type}</span>
                  <span className="text-gray-600">Qty: {peripheral.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Remarks */}
        {user.remarks && (
          <div className="it-user-print-section">
            <h3 className="it-user-print-section-title">Remarks</h3>
            <p className="text-gray-700">{user.remarks}</p>
          </div>
        )}

        {/* Footer */}
        <div className="it-user-print-footer">
          <p>Created by IT Team - MNR Group</p>
          <p className="text-sm opacity-80">
            Printed on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  }
);

ITUserPrintCard.displayName = "ITUserPrintCard";

export default ITUserPrintCard;

import { Printer } from "lucide-react";

interface PrinterData {
  id: number;
  printer_name: string;
  printer_model: string;
  ip_address: string;
  unit_number: string;
  department_name: string;
  added_date: string;
}

interface PrinterPrintCardProps {
  printers: PrinterData[];
  unitName?: string;
  departmentName?: string;
}

const PrinterPrintCard = ({ printers, unitName, departmentName }: PrinterPrintCardProps) => {
  // Group printers by unit and department
  const groupedPrinters: { [unit: string]: { [dept: string]: PrinterData[] } } = {};
  
  printers.forEach(printer => {
    const unit = printer.unit_number || "Unknown Unit";
    const dept = printer.department_name || "Unknown Department";
    
    if (!groupedPrinters[unit]) {
      groupedPrinters[unit] = {};
    }
    if (!groupedPrinters[unit][dept]) {
      groupedPrinters[unit][dept] = [];
    }
    groupedPrinters[unit][dept].push(printer);
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print Button - Hidden in print */}
      <button
        onClick={handlePrint}
        className="print:hidden fixed bottom-4 right-4 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg hover:bg-primary/90 transition-all z-50 flex items-center gap-2"
      >
        <Printer className="h-5 w-5" />
        Print Printers List
      </button>

      {/* Print Content */}
      <div className="printer-print-content hidden print:block">
        {/* Header */}
        <div className="printer-print-header">
          <div className="flex items-center justify-between border-b-2 border-primary pb-4 mb-6">
            <div className="flex items-center gap-4">
              <img 
                src="/pictures/a036b691-f157-44ee-9c7c-6c641ef0b004.png" 
                alt="MNR Group Logo" 
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-primary">MNR Group</h1>
                <p className="text-sm text-muted-foreground">IT Department - Printer Inventory</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Printers List</p>
              <p className="text-xs text-muted-foreground">
                Generated: {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              {unitName && <p className="text-xs text-primary font-medium mt-1">Unit: {unitName}</p>}
              {departmentName && <p className="text-xs text-primary font-medium">Dept: {departmentName}</p>}
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-primary/5 p-4 rounded-lg text-center border border-primary/20">
            <p className="text-3xl font-bold text-primary">{printers.length}</p>
            <p className="text-sm text-muted-foreground">Total Printers</p>
          </div>
          <div className="bg-primary/5 p-4 rounded-lg text-center border border-primary/20">
            <p className="text-3xl font-bold text-primary">{Object.keys(groupedPrinters).length}</p>
            <p className="text-sm text-muted-foreground">Units/Offices</p>
          </div>
          <div className="bg-primary/5 p-4 rounded-lg text-center border border-primary/20">
            <p className="text-3xl font-bold text-primary">
              {Object.values(groupedPrinters).reduce((acc, depts) => acc + Object.keys(depts).length, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Departments</p>
          </div>
        </div>

        {/* Printers by Unit and Department */}
        {Object.entries(groupedPrinters).map(([unit, departments]) => (
          <div key={unit} className="mb-8 page-break-inside-avoid">
            <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-3 rounded-t-lg">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Printer className="h-5 w-5" />
                {unit}
              </h2>
              <p className="text-sm opacity-90">
                {Object.values(departments).reduce((acc, printers) => acc + printers.length, 0)} Printers | {Object.keys(departments).length} Departments
              </p>
            </div>
            
            {Object.entries(departments).map(([dept, deptPrinters]) => (
              <div key={dept} className="border border-primary/20 rounded-b-lg mb-4">
                <div className="bg-primary/10 px-4 py-2 border-b border-primary/20">
                  <h3 className="font-semibold text-primary">{dept}</h3>
                  <p className="text-xs text-muted-foreground">{deptPrinters.length} Printer(s)</p>
                </div>
                
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground border-b">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground border-b">Printer Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground border-b">Model</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground border-b">IP Address / Share</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground border-b">Added Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptPrinters.map((printer, index) => (
                      <tr key={printer.id} className="border-b border-muted/30 hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm">{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{printer.printer_name}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{printer.printer_model}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {printer.ip_address}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {printer.added_date ? new Date(printer.added_date).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div className="printer-print-footer mt-8 pt-4 border-t-2 border-primary">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} MNR Group - IT Department</p>
            <p>Confidential - Internal Use Only</p>
            <p>Created by IT Team</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrinterPrintCard;

import { Phone, Building2 } from "lucide-react";

interface IPPhone {
  id: number;
  sl_no?: number;
  extension_number: string;
  ip_address: string;
  user_name: string;
  designation: string;
  department_name: string;
  office_name: string;
  phone_model: string;
  status: string;
}

interface IPPhonePrintCardProps {
  phones: IPPhone[];
  officeName?: string;
  departmentName?: string;
}

const IPPhonePrintCard = ({ phones, officeName, departmentName }: IPPhonePrintCardProps) => {
  // Group phones by office first
  const groupedByOffice: { [key: string]: IPPhone[] } = {};
  
  phones.forEach(phone => {
    const office = phone.office_name || 'Unknown Office';
    if (!groupedByOffice[office]) {
      groupedByOffice[office] = [];
    }
    groupedByOffice[office].push(phone);
  });

  // Sort phones by SL number within each office
  Object.keys(groupedByOffice).forEach(office => {
    groupedByOffice[office].sort((a, b) => (a.sl_no || 0) - (b.sl_no || 0));
  });

  const officeEntries = Object.entries(groupedByOffice);
  
  // Split into pages with 5 offices per page
  const officesPerPage = 5;
  const pages: [string, IPPhone[]][][] = [];
  
  for (let i = 0; i < officeEntries.length; i += officesPerPage) {
    pages.push(officeEntries.slice(i, i + officesPerPage));
  }

  return (
    <div className="ip-phone-print-layout print-only hidden print:block bg-white">
      {pages.map((pageOffices, pageIndex) => (
        <div 
          key={pageIndex} 
          className="page-container"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '5mm',
            pageBreakAfter: pageIndex < pages.length - 1 ? 'always' : 'auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Print Header */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '4mm', 
            paddingBottom: '2mm', 
            borderBottom: '2px solid #0066cc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <img 
                src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" 
                alt="MNR Group Logo" 
                style={{ height: '40px', width: 'auto' }}
              />
              <div>
                <h1 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0066cc', margin: '0' }}>MNR Group</h1>
                <p style={{ fontSize: '11px', color: '#444', margin: '2px 0' }}>Listing of IP Phone Extension</p>
                <p style={{ fontSize: '8px', color: '#666', margin: '0' }}>
                  Head Office: House # 88/A, Road # 04, DOHS Baridhara, Dhaka-1206
                </p>
              </div>
            </div>
            <p style={{ fontSize: '7px', color: '#888', marginTop: '2px' }}>
              Factory: Borodolian, Kishoreganj-Madanali, Sreeopur, Gazipur-1740
            </p>
          </div>

          {/* 5-Column Office Layout */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(5, 1fr)', 
            gap: '2mm',
            fontSize: '7px',
          }}>
            {pageOffices.map(([office, officePhones]) => (
              <div key={office} style={{ pageBreakInside: 'avoid' }}>
                {/* Office Header */}
                <div style={{ 
                  backgroundColor: '#0066cc', 
                  color: 'white', 
                  padding: '3px 4px', 
                  fontSize: '8px',
                  fontWeight: 'bold',
                  borderRadius: '2px 2px 0 0',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {office}
                </div>

                {/* Extension Table */}
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  fontSize: '7px',
                  tableLayout: 'fixed',
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#cce5ff' }}>
                      <th style={{ 
                        border: '1px solid #999', 
                        padding: '2px', 
                        width: '18px',
                        fontSize: '6px',
                        fontWeight: 'bold',
                      }}>SL No</th>
                      <th style={{ 
                        border: '1px solid #999', 
                        padding: '2px', 
                        width: '25px',
                        fontSize: '6px',
                        fontWeight: 'bold',
                      }}>Ext. No.</th>
                      <th style={{ 
                        border: '1px solid #999', 
                        padding: '2px',
                        fontSize: '6px',
                        fontWeight: 'bold',
                      }}>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officePhones.map((phone, index) => (
                      <tr key={phone.id}>
                        <td style={{ 
                          border: '1px solid #ccc', 
                          padding: '1px 2px', 
                          textAlign: 'center',
                          fontSize: '7px',
                          fontWeight: 'bold',
                          color: '#0066cc',
                        }}>
                          {index + 1}
                        </td>
                        <td style={{ 
                          border: '1px solid #ccc', 
                          padding: '1px 2px', 
                          fontWeight: 'bold',
                          color: '#0066cc',
                          fontSize: '7px',
                        }}>
                          {phone.extension_number}
                        </td>
                        <td style={{ 
                          border: '1px solid #ccc', 
                          padding: '1px 2px',
                          fontSize: '6.5px',
                          lineHeight: '1.2',
                          wordBreak: 'break-word',
                        }}>
                          <div style={{ fontWeight: '500' }}>{phone.user_name}</div>
                          {phone.designation && (
                            <div style={{ fontSize: '5.5px', color: '#666' }}>{phone.designation}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Page Footer with Stats - only on last page */}
          {pageIndex === pages.length - 1 && (
            <div style={{ 
              marginTop: '4mm', 
              paddingTop: '2mm', 
              borderTop: '1px solid #0066cc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '8px',
            }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#0066cc' }}>{phones.length}</span>
                  <span style={{ color: '#666', marginLeft: '3px' }}>Total Extensions</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#28a745' }}>{officeEntries.length}</span>
                  <span style={{ color: '#666', marginLeft: '3px' }}>Units/Offices</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#6c5ce7' }}>{phones.filter(p => p.status === 'active').length}</span>
                  <span style={{ color: '#666', marginLeft: '3px' }}>Active Lines</span>
                </div>
              </div>
              <div style={{ color: '#666' }}>
                MNR Group IT Department | Generated: {new Date().toLocaleDateString('en-GB')}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default IPPhonePrintCard;
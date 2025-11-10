// zones.js — std_area_code 기반 mock 데이터 (company_code = cs0376)

const ZONES_CS0376 = [
    { id: "A003", name: "무연 냉장고" },
    { id: "A007", name: "SMT현장1" },
    { id: "A008", name: "자재실" },
    { id: "A009", name: "sp2" },
    { id: "A010", name: "sp3" },
    { id: "A019", name: "sp6" },
    { id: "A020", name: "sp4" },
    { id: "A021", name: "sp1" },
    { id: "A022", name: "sp5" },
    { id: "A023", name: "sp7" },
    { id: "A024", name: "sp8" },
    { id: "A027", name: "제습기1" },
    { id: "A029", name: "SMT현장2" },
    { id: "A030", name: "수입검사실" },
    { id: "A031", name: "SP9" },
  ];
  
  export async function getZones(company = "cs0376") {
    return ZONES_CS0376;
  }
  
  export async function getZone(zoneId, company = "cs0376") {
    return ZONES_CS0376.find((z) => z.id === zoneId) ?? null;
  }
  
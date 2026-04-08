export interface Participant {
  "MATCH ID": string;
  "MATCH NAME": string;
  STT: string;
  "USER ID": string;
  "SO BIB": string;
  "CU LY": string;
  NAM: string;
  NU: string;
  "NAM SINH": string;
  "NGHE NGHIEP": string;
  "QUOC TICH": string;
  "TINH THANH": string;
  "CO AO": string;
  "SO TIEN": string;
  "LOAI DANG KY": string;
  "THANH TICH": string;
  STAGE: string;
  "THOI GIAN TAO": string;
  "THOI GIAN CAP NHAT": string;
}

export interface DashboardStats {
  total: number;
  byDistance: Record<string, number>;
  byGender: { male: number; female: number; unknown: number };
  byAgeGroup: Record<string, number>;
  byRegType: Record<string, number>;
  byProvince: Record<string, number>;
  byOccupation: Record<string, number>;
}

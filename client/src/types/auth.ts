export type UserRole = 'worker' | 'verifier' | 'advocate';

export interface AuthUser {
  id:           string;
  email:        string;
  displayName:  string;
  role:         UserRole;
  cityZoneId:   string | null;
  cityZoneName: string | null;
}

export interface CityZone {
  id:   string;
  name: string;
  city: string;
}

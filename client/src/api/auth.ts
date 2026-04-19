import { authClient } from './client';
import type { AuthUser } from '../stores/authStore';

export interface LoginPayload {
  email:    string;
  password: string;
}

export interface RegisterPayload {
  email:        string;
  password:     string;
  display_name: string;
  role:         string;
  phone?:       string;
  city_zone_id?: string;
}

export interface TokenPair {
  access_token:  string;
  refresh_token: string;
  token_type:    string;
}

export interface RegisterResponse extends TokenPair {
  user: AuthUser;
}

export interface CityZone {
  id:   string;
  name: string;
  city: string;
}

export const authApi = {
  login:      (payload: LoginPayload)    => authClient.post<TokenPair>('/api/auth/login', payload),
  register:   (payload: RegisterPayload) => authClient.post<RegisterResponse>('/api/auth/register', payload),
  me:         ()                         => authClient.get<AuthUser>('/api/auth/me'),
  refresh:    (token: string)            => authClient.post<TokenPair>('/api/auth/refresh', { refresh_token: token }),
  validate:   ()                         => authClient.get('/api/auth/validate'),
  cityZones:  ()                         => authClient.get<CityZone[]>('/api/auth/city-zones'),
};

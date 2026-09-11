export const GO_CONTACT_COOKIE = "passe_go_contact";

export type GoContactProfile = {
  id: string;
  contactPhone: string | null;
  contactInstagram: string | null;
  etransferName: string | null;
  etransferEmail: string | null;
  etransferPhone: string | null;
  memberId: string | null;
};

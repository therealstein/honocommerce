/**
 * Setting Formatter
 */

export interface SettingGroupResponse {
  id: string;
  label: string;
  description: string;
  settings: SettingResponse[];
  _links?: Record<string, Array<{ href: string }>>;
}

export interface SettingResponse {
  id: string;
  label: string;
  description: string;
  type: string;
  default: string;
  value: string;
  options: Record<string, string>;
  _links: Record<string, Array<{ href: string }>>;
}

export const formatSettingGroupResponse = (
  groupId: string,
  group: { id: string; label: string; description: string; settings: any[] }
): SettingGroupResponse => ({
  id: group.id,
  label: group.label,
  description: group.description,
  settings: group.settings,
  _links: {
    self: [{ href: `/wp-json/wc/v3/settings/${groupId}` }],
    collection: [{ href: '/wp-json/wc/v3/settings' }],
  },
});

export const formatSettingResponse = (
  groupId: string,
  setting: SettingResponse
): SettingResponse => setting;

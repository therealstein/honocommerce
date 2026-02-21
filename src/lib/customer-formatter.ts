/**
 * Customer Response Formatter
 */

import type { Customer } from '../db/schema/customers';
import { buildLinks, formatDate, formatDateGmt } from './wc-response';

export interface CustomerResponse {
  id: number;
  date_created: string | null;
  date_created_gmt: string | null;
  date_modified: string | null;
  date_modified_gmt: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  username: string | null;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  is_paying_customer: boolean;
  avatar_url: string;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  _links: Record<string, Array<{ href: string }>>;
}

// Generate Gravatar URL from email
const getGravatarUrl = (email: string): string => {
  const hash = email.toLowerCase().trim();
  // Simple hash for gravatar (in production, use proper MD5)
  return `https://secure.gravatar.com/avatar/?s=96&d=mm&r=g`;
};

export const formatCustomerResponse = (customer: Customer): CustomerResponse => {
  const billing = customer.billing as CustomerResponse['billing'];
  const shipping = customer.shipping as CustomerResponse['shipping'];
  
  return {
    id: customer.id,
    date_created: formatDate(customer.dateCreated),
    date_created_gmt: formatDateGmt(customer.dateCreatedGmt),
    date_modified: formatDate(customer.dateModified),
    date_modified_gmt: formatDateGmt(customer.dateModifiedGmt),
    email: customer.email,
    first_name: customer.firstName,
    last_name: customer.lastName,
    role: customer.role,
    username: customer.username,
    billing: {
      first_name: billing?.first_name ?? '',
      last_name: billing?.last_name ?? '',
      company: billing?.company ?? '',
      address_1: billing?.address_1 ?? '',
      address_2: billing?.address_2 ?? '',
      city: billing?.city ?? '',
      state: billing?.state ?? '',
      postcode: billing?.postcode ?? '',
      country: billing?.country ?? '',
      email: billing?.email ?? customer.email,
      phone: billing?.phone ?? '',
    },
    shipping: {
      first_name: shipping?.first_name ?? '',
      last_name: shipping?.last_name ?? '',
      company: shipping?.company ?? '',
      address_1: shipping?.address_1 ?? '',
      address_2: shipping?.address_2 ?? '',
      city: shipping?.city ?? '',
      state: shipping?.state ?? '',
      postcode: shipping?.postcode ?? '',
      country: shipping?.country ?? '',
    },
    is_paying_customer: customer.isPayingCustomer,
    avatar_url: customer.avatarUrl ?? getGravatarUrl(customer.email),
    meta_data: (customer.metaData as Array<{ key: string; value: unknown }>)?.map((m, i) => ({ ...m, id: i })) ?? [],
    _links: buildLinks(
      `/wp-json/wc/v3/customers/${customer.id}`,
      '/wp-json/wc/v3/customers'
    ),
  };
};

export const formatCustomerListResponse = (customers: Customer[]): CustomerResponse[] =>
  customers.map(formatCustomerResponse);

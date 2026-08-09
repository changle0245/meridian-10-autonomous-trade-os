import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { hashPortalToken } from "@/server/crypto";

export type PortalSqlExecutor = (query: SQL) => Promise<unknown>;

const milestoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.string(),
  plannedAt: z.string().nullable(),
  actualAt: z.string().nullable(),
  owner: z.string().nullable(),
  evidence: z.record(z.string(), z.unknown()),
  customerMessage: z.string().nullable(),
});

const portalRowSchema = z.object({
  grant_id: z.string(),
  company: z.string(),
  order_id: z.string(),
  stage: z.string(),
  destination: z.string(),
  estimated_departure: z.string().nullable(),
  estimated_arrival: z.string().nullable(),
  container: z.string().nullable(),
  milestones: z.array(milestoneSchema),
});

export interface PortalSnapshot {
  grantId: string;
  company: string;
  orderId: string;
  stage: string;
  destination: string;
  estimatedDeparture: string | null;
  estimatedArrival: string | null;
  container: string | null;
  milestones: z.infer<typeof milestoneSchema>[];
}

function rows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows;
  return [];
}

export async function getPortalSnapshot(execute: PortalSqlExecutor, token: string): Promise<PortalSnapshot | null> {
  const tokenHash = hashPortalToken(token);
  const result = await execute(sql`
    select
      portal_grant.id as grant_id,
      company.legal_name as company,
      sales_order.order_number as order_id,
      sales_order.stage::text as stage,
      sales_order.destination,
      sales_order.estimated_departure::text,
      sales_order.estimated_arrival::text,
      sales_order.container,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', milestone.id,
            'label', milestone.label,
            'status', milestone.status,
            'plannedAt', milestone.planned_at,
            'actualAt', milestone.actual_at,
            'owner', milestone.owner,
            'evidence', milestone.evidence,
            'customerMessage', milestone.customer_message
          ) order by milestone.sequence
        ) filter (where milestone.id is not null),
        '[]'::jsonb
      ) as milestones
    from portal_grants as portal_grant
    inner join customers as customer
      on customer.id = portal_grant.customer_id and customer.organization_id = portal_grant.organization_id
    inner join companies as company
      on company.id = customer.company_id and company.organization_id = portal_grant.organization_id
    inner join sales_orders as sales_order
      on sales_order.id = portal_grant.sales_order_id and sales_order.organization_id = portal_grant.organization_id
    left join shipments as shipment
      on shipment.sales_order_id = sales_order.id and shipment.organization_id = portal_grant.organization_id
    left join shipment_milestones as milestone
      on milestone.shipment_id = shipment.id and milestone.organization_id = portal_grant.organization_id
    where portal_grant.token_hash = ${tokenHash}
      and portal_grant.status = 'ACTIVE'
      and portal_grant.revoked_at is null
      and portal_grant.expires_at > now()
    group by portal_grant.id, company.legal_name, sales_order.id
    limit 1
  `);
  const candidate = rows(result)[0];
  if (!candidate) return null;
  const row = portalRowSchema.parse(candidate);

  await execute(sql`
    update portal_grants
    set last_accessed_at = now()
    where id = ${row.grant_id} and token_hash = ${tokenHash}
  `);

  return {
    grantId: row.grant_id,
    company: row.company,
    orderId: row.order_id,
    stage: row.stage,
    destination: row.destination,
    estimatedDeparture: row.estimated_departure,
    estimatedArrival: row.estimated_arrival,
    container: row.container,
    milestones: row.milestones,
  };
}

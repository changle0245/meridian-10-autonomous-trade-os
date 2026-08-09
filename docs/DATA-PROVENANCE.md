# Data provenance

## Dataset status

Every entity in this repository is deterministic fictional test data created for MERIDIAN 10. Similarities to real organizations or people are coincidental.

| Dataset | Contents | Provenance | Real-world action |
|---|---|---|---|
| Leads | companies, regions, demand and synthetic source signals | in-repository fixture generator | none |
| Due diligence | registrations, screening statuses, confidence and TTL | synthetic evidence fixtures | none |
| Customers | preferences, terms, tags and value | promoted synthetic leads | none |
| Suppliers | scorecards, categories and open PO counts | synthetic fixtures | no purchase order sent |
| Inventory | on-hand, reserved, production and inbound quantities | synthetic versioned snapshot | no warehouse write |
| Quotes/orders | lines, terms, dates and amounts | deterministic synthetic transactions | no contract formed |
| Costs | procurement, freight, insurance, duty and fees | synthetic ledger fixtures | no payment or accounting post |
| Events | user and agent actions | locally generated demo journal | no external notification |

## Provenance rules for real integrations

Each future external observation should store provider, source identifier, lawful purpose, observed time, expiry, confidence, permitted uses and deletion policy. Derived decisions should link to the exact source versions that produced them. Data of uncertain origin must not silently enter a customer record or decision model.

Personal contact enrichment, outreach lists and screening data require separate privacy, consent, suppression, retention and appeal controls. This repository does not provide or imply those permissions.

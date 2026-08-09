# Trade document responsibility matrix

The PDF factory proves data consistency and rendering; it does not replace licensed review or government filing.

| Document | Primary source | Automated checks | Required real-world owner | Demo status |
|---|---|---|---|---|
| Quotation | quote lines, customer terms, FX and landed cost | totals, currency, margin guard | sales + finance | synthetic draft |
| Pro forma invoice | accepted quote and order | totals, terms, dates, consignee | sales + finance | synthetic draft |
| Commercial invoice | released order | quantity, value, currency, parties | finance + trade operations | synthetic draft |
| Purchase order | order and supplier allocation | quantity, price, supplier reference | procurement | not transmitted |
| Packing list | product carton and weight data | carton count, net/gross weight | warehouse + forwarder | weights require scale ticket |
| Customs declaration | HS fixture, value, origin and ports | completeness and cross-document consistency | licensed customs broker | **DRAFT — NOT FOR FILING** |
| Certificate of origin | supplier-origin declarations and order | destination and goods consistency | chamber/broker/legal owner | **DRAFT — NOT FOR CERTIFICATION** |
| Shipment progress report | milestone state and schedule | current-state and redaction rules | trade operations | draft customer update |

All documents include a `SYNTHETIC DEMO — NOT FOR FILING` watermark and a footer requiring customs, tax, legal and banking review before use.

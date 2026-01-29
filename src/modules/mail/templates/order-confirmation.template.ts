interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface OrderConfirmationData {
  name: string;
  orderNumber: string;
  orderDate: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  tax: number;
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  orderLink: string;
  currentYear: number;
}

export function getOrderConfirmationEmailHtml(data: OrderConfirmationData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${item.product_name}</strong>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          $${Number(item.price).toFixed(2)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          $${Number(item.subtotal).toFixed(2)}
        </td>
      </tr>
    `,
    )
    .join('');

  const addressLine2 = data.shippingAddress.addressLine2
    ? `<br>${data.shippingAddress.addressLine2}`
    : '';
  const statePostal = [data.shippingAddress.state, data.shippingAddress.postalCode]
    .filter(Boolean)
    .join(' ');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #000000; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Order Confirmed!</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                Hi ${data.name},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">
                Thank you for your order! We've received your order and are processing it now.
              </p>

              <!-- Order Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Order Number</p>
                    <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111827;">${data.orderNumber}</p>
                    <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Order Date</p>
                    <p style="margin: 0; font-size: 16px; color: #111827;">${data.orderDate}</p>
                  </td>
                </tr>
              </table>

              <!-- Items Table -->
              <h3 style="margin: 0 0 15px; font-size: 18px; color: #111827;">Order Items</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-size: 14px; color: #6b7280;">Product</th>
                    <th style="padding: 12px; text-align: center; font-size: 14px; color: #6b7280;">Qty</th>
                    <th style="padding: 12px; text-align: right; font-size: 14px; color: #6b7280;">Price</th>
                    <th style="padding: 12px; text-align: right; font-size: 14px; color: #6b7280;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Subtotal</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #374151;">$${data.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Shipping</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #374151;">${data.shippingFee === 0 ? 'Free' : '$' + data.shippingFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Tax</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #374151;">$${data.tax.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-size: 18px; font-weight: 600; color: #111827; border-top: 2px solid #e5e7eb;">Total</td>
                  <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: 600; color: #111827; border-top: 2px solid #e5e7eb;">$${data.total.toFixed(2)}</td>
                </tr>
              </table>

              <!-- Shipping Address -->
              <h3 style="margin: 0 0 15px; font-size: 18px; color: #111827;">Shipping Address</h3>
              <p style="margin: 0 0 30px; font-size: 14px; color: #374151; line-height: 1.6;">
                ${data.shippingAddress.firstName} ${data.shippingAddress.lastName}<br>
                ${data.shippingAddress.addressLine1}${addressLine2}<br>
                ${data.shippingAddress.city}${statePostal ? ', ' + statePostal : ''}<br>
                ${data.shippingAddress.country}
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.orderLink}" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      View Order
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                Questions? Reply to this email or contact our support team.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${data.currentYear} Baccon Store. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

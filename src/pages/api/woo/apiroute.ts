import WooCommerceRestApi from "woocommerce-rest-ts-api";

// Setup WooCommerce client
const WooCommerce = new WooCommerceRestApi({
  url: 'https://rental.mariohans.cl',
  consumerKey: import.meta.env.WOOCOMMERCE_CONSUMER_KEY,
  consumerSecret: import.meta.env.WOOCOMMERCE_CONSUMER_SECRET,
  version: 'wc/v3',
  queryStringAuth: true // Force Basic Auth as query string
});

export default WooCommerce;


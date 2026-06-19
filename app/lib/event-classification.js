export function isRealStorefrontEvent(event) {
  return event?.source === "storefront-proxy";
}

export function partitionSecurityEvents(events = []) {
  return events.reduce(
    (groups, event) => {
      if (isRealStorefrontEvent(event)) {
        groups.storefront.push(event);
      } else {
        groups.simulated.push(event);
      }
      return groups;
    },
    { storefront: [], simulated: [] },
  );
}

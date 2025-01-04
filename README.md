# Brains and Bets

Heavily based on Wits and Wagers, it uses playroom SDK as the backend for state management instead of hosting it via cloudflare durable objects websockets and a synced pinia instance.

## TODO:

- Move to a reducer for React + createContext so logic is in one spot
- Show answers on betting screen with groupings (kmeans)
- Allow people to make wagers
- Award points based on bets
- Custom lobby as BigScreen doesn't appear correctly as it shows up as a player

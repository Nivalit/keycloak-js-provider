# Nivalit - Keycloak JS Provider

Simple Facade for simplify the authorization integration with keycloak identity provider.

## Quick Start

For React Single Page Applications just use following snippet:

_index.tsx_

```typescript
new KeycloakAuthBuilder(
  'http://authServerUrl:PORT',
  'clientId',
  'realmName',
  () =>
    ReactDOM.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
      document.getElementById('root')
    )
)
  .addPublicPath('/signup')
  .build()
  .init()
```

## Usage in code

Keycloak Authorization Service is a singleton instance that provides basic methods such as `logout()`, `hasClientRoles()`, `getProfile()` and `isLoggedIn()`. You can use it just from service instance in any place in code.

```typescript
KeycloakAuthService.getInstance().logout()
```

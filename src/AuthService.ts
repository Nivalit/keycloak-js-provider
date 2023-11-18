/* eslint-disable no-param-reassign */
/* eslint-disable no-promise-executor-return */
/* eslint-disable no-console */
import axios from 'axios'
import Keycloak, {
  KeycloakOnLoad,
  KeycloakPkceMethod,
  KeycloakProfile,
} from 'keycloak-js'

export class KeycloakAuthService {
  private static instance: KeycloakAuthService

  private config: KeycloakAuthBuilderI

  private keycloak: Keycloak

  private constructor(builder: KeycloakAuthBuilderI) {
    this.config = builder
    this.keycloak = new Keycloak({
      url: builder.url,
      clientId: builder.clientId,
      realm: builder.realmName,
    })
  }

  public static getInstance() {
    if (KeycloakAuthService.instance === null) {
      throw Error('Keycloak instance is not accessible')
    }
    return KeycloakAuthService.instance
  }

  public static fromBuilder(builder: KeycloakAuthBuilderI) {
    this.instance = new KeycloakAuthService(builder)
    return this.instance
  }

  public init() {
    this.initAxios()
    this.keycloak
      .init({
        onLoad: this.config.onLoadMethod,
        silentCheckSsoRedirectUri: `${window.location.origin}/auth/silent-check-sso.html`,
        pkceMethod: this.config.pkceMethod,
      })
      .then((authenticated) => {
        if (!authenticated) {
          this.keycloak.login()
        }
        this.config.onAuthenticated()
      })
      .catch((e) => {
        console.error('⚠️ Failed to authenticate user', e)
        if (this.config.onError) {
          this.config.onError()
        } else {
          this.config.onAuthenticated()
        }
      })
  }

  private unauthenticatedPath(): boolean {
    if (
      this.config.unauthenticatedPaths.some(
        (path) => path === window.location.pathname
      )
    ) {
      return true
    }
    return this.config.unauthenticatedPathsWildcards.some((path) =>
      window.location.pathname.includes(path)
    )
  }

  private updateToken(successCallback: () => void) {
    this.keycloak
      .updateToken(this.config.tokenValidity)
      .then(successCallback)
      .catch(this.keycloak.login)
  }

  private initAxios() {
    axios.defaults.headers.post['Content-Type'] = 'application/json'
    axios.defaults.headers.get['Content-Type'] = 'application/json'
    axios.defaults.headers.put['Content-Type'] = 'application/json'
    axios.interceptors.request.use((axiosConfig) =>
      this.unauthenticatedPath() && !this.keycloak.token
        ? Promise.resolve(axiosConfig)
        : new Promise((resolve) => {
          this.updateToken(() => {
            const { token } = this.keycloak
            if (token && axiosConfig && axiosConfig.headers) {
              axiosConfig.headers.Authorization = `Bearer ${token}`
            }
            resolve(axiosConfig)
          })
        })
    )
  }

  public hasClientRoles(roles: string[], exact = false): boolean {
    const clientRoles =
      this.keycloak.resourceAccess?.[this.config.clientId]?.roles || []

    return exact
      ? clientRoles.every((role) => roles.includes(role))
      : clientRoles.some((role) => roles.includes(role))
  }

  public isLoggedIn(): boolean {
    return !!this.keycloak.token
  }

  public getProfile(): KeycloakProfile | undefined {
    return this.keycloak.profile
  }

  public logout() {
    this.keycloak.logout()
  }
}

interface KeycloakAuthBuilderI {
  url: string
  clientId: string
  realmName: string
  onAuthenticated: () => void
  onError?: () => void
  unauthenticatedPaths: string[]
  unauthenticatedPathsWildcards: string[]
  tokenValidity: number
  pkceMethod?: KeycloakPkceMethod
  onLoadMethod: KeycloakOnLoad
}

export class KeycloakAuthBuilder {
  private unauthenticatedPaths: string[]

  private unauthenticatedPathsWildcards: string[]

  private tokenValidity: number

  private pkceMethod?: KeycloakPkceMethod

  private onLoadMethod: KeycloakOnLoad

  private onAuthenticated: () => void

  private onError?: () => void

  constructor(
    private url: string,
    private clientId: string,
    private realmName: string,
    onAuthenticated: () => void
  ) {
    this.unauthenticatedPaths = []
    this.unauthenticatedPathsWildcards = []
    this.tokenValidity = 10
    this.pkceMethod = 'S256'
    this.onLoadMethod = 'check-sso'
    this.onAuthenticated = onAuthenticated
  }

  public addPublicPath(path: string) {
    this.unauthenticatedPaths.push(path)
    return this
  }

  public addPublicWildcard(path: string) {
    this.unauthenticatedPathsWildcards.push(path)
    return this
  }

  public setTokenValidity(minValidity: number) {
    this.tokenValidity = minValidity
    return this
  }

  public setPckeMethod(method: KeycloakPkceMethod | undefined) {
    this.pkceMethod = method
    return this
  }

  public setOnLoadMethod(method: KeycloakOnLoad) {
    this.onLoadMethod = method
    return this
  }

  public setOnError(callback: () => void) {
    this.onError = callback
  }

  public build(): KeycloakAuthService {
    return KeycloakAuthService.fromBuilder({
      url: this.url,
      clientId: this.clientId,
      realmName: this.realmName,
      onAuthenticated: this.onAuthenticated,
      onError: this.onError,
      unauthenticatedPaths: this.unauthenticatedPaths,
      unauthenticatedPathsWildcards: this.unauthenticatedPathsWildcards,
      tokenValidity: this.tokenValidity,
      pkceMethod: this.pkceMethod,
      onLoadMethod: this.onLoadMethod,
    })
  }
}

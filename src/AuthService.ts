/* eslint-disable no-param-reassign */
/* eslint-disable no-promise-executor-return */
/* eslint-disable no-console */
import { AxiosInstance } from 'axios'
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

  /**
   * Initialize
   * 
   * Try to initialize Keycloak Client based
   * on the provided configuration.
   */
  public init() {
    for (let i = 0; i < this.config.axiosInstances.length; i = i + 1) {
      this.initAxios(this.config.axiosInstances[i])
    }

    this.keycloak
      .init({
        onLoad: this.config.onLoadMethod,
        silentCheckSsoRedirectUri: `${window.location.origin}/auth/silent-check-sso.html`,
        pkceMethod: this.config.pkceMethod,
      })
      .then((authenticated) => {
        if (!authenticated && !this.isPublicPath()) {
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

  private isPublicPath(): boolean {
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

  /**
   * Initialize Axios Instance
   * 
   * Setup headers to send application/json content type 
   * and add Authorization Header with bearer token when trying 
   * to access to protected path.
   * @param {AxiosInstance} instance AxiosInstance which should be modified.
   */
  public initAxios(instance: AxiosInstance): void {
    instance.defaults.headers.post['Content-Type'] = 'application/json'
    instance.defaults.headers.get['Content-Type'] = 'application/json'
    instance.defaults.headers.put['Content-Type'] = 'application/json'
    instance.interceptors.request.use((axiosConfig) =>
      this.isPublicPath() && !this.keycloak.token
        ? Promise.resolve(axiosConfig)
        : new Promise((resolve) => {
          this.updateToken(() => {
            const { token } = this.keycloak
            if (token && axiosConfig && axiosConfig.headers) {
              axiosConfig.headers.Authorization = `Bearer ${token}`
              axiosConfig.headers.common['session_id'] = this.keycloak.sessionId
            }
            resolve(axiosConfig)
          })
        })
    )
  }

  public hasClientRoles(roles: string[], exact = false, clientId = this.config.clientId): boolean {
    const clientRoles =
      this.keycloak.resourceAccess?.[clientId]?.roles || []

    return exact
      ? clientRoles.every((role) => roles.includes(role))
      : clientRoles.some((role) => roles.includes(role))
  }

  public hasRealmRoles(roles: string[], exact = false): boolean {
    const realmRoles =
      this.keycloak.realmAccess?.roles || []
    return exact
      ? realmRoles.every((role) => roles.includes(role))
      : realmRoles.some((role) => roles.includes(role))
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
  axiosInstances: AxiosInstance[]
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

  private axiosInstances: AxiosInstance[]

  constructor(
    private url: string,
    private clientId: string,
    private realmName: string,
    onAuthenticated: () => void
  ) {
    this.axiosInstances = []
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

  public addClient(client: AxiosInstance) {
    this.axiosInstances.push(client)
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
      axiosInstances: this.axiosInstances,
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

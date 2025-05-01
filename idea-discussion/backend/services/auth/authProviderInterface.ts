export default class AuthProviderInterface {
  async authenticate(credentials: Record<string, any>): Promise<any> {
    throw new Error("Method 'authenticate' must be implemented");
  }
}

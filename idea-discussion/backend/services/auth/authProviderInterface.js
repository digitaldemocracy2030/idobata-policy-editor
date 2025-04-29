export default class AuthProviderInterface {
  async authenticate(credentials) {
    throw new Error("Method 'authenticate' must be implemented");
  }
}

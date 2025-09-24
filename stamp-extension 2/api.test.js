// Unit tests for ApiClient in content.js

describe('ApiClient', () => {
  beforeEach(() => {
    // Mock chrome APIs and fetch
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
        },
      },
    };
    global.fetch = jest.fn();
  });

  test('should make an authenticated request with correct headers', async () => {
    chrome.storage.local.get.mockResolvedValue({
      installationId: 'test_installation_id',
      userEmail: 'test@example.com'
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    });

    const apiClient = new ApiClient();
    const response = await apiClient.makeAuthenticatedRequest('/test');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Installation-ID': 'test_installation_id',
          'X-User-Email': 'test@example.com',
          'Content-Type': 'application/json'
        })
      })
    );
  });

  test('should throw an error if user is not authenticated', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    const apiClient = new ApiClient();
    await expect(apiClient.makeAuthenticatedRequest('/test')).rejects.toThrow(
      'User not authenticated. Please sign in first.'
    );
  });

  test('should handle API errors correctly', async () => {
    chrome.storage.local.get.mockResolvedValue({
      installationId: 'test_installation_id'
    });

    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid token')
    });

    const apiClient = new ApiClient();
    await expect(apiClient.makeAuthenticatedRequest('/test')).rejects.toThrow(
      'API request failed: 401 Unauthorized - Invalid token'
    );
  });

  test('should get user data successfully', async () => {
    chrome.storage.local.get.mockResolvedValue({
      installationId: 'test_installation_id'
    });

    const mockUserData = { id: 'user123', email: 'test@example.com' };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserData)
    });

    const apiClient = new ApiClient();
    const userData = await apiClient.getUserData();

    expect(userData).toEqual(mockUserData);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/user'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Installation-ID': 'test_installation_id'
        })
      })
    );
  });

  test('should get email status successfully', async () => {
    chrome.storage.local.get.mockResolvedValue({
      installationId: 'test_installation_id'
    });

    const mockStatus = { processing: true, lastCheck: '2024-01-01T00:00:00Z' };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatus)
    });

    const apiClient = new ApiClient();
    const status = await apiClient.getEmailStatus();

    expect(status).toEqual(mockStatus);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/status'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Installation-ID': 'test_installation_id'
        })
      })
    );
  });
}); 
const sanitize = (value: string | null | undefined): string | null => {
  if (!value || value === 'undefined' || value.trim() === '') {
    return null
  }
  return value
}

export const getUserId = (): string | null => sanitize(localStorage.getItem('xuebanuserid'))
export const getPassword = (): string | null => sanitize(localStorage.getItem('userPassword'))
export const getXuebanToken = (): string | null => sanitize(localStorage.getItem('XUEBAN_TOKEN'))
export const setXuebanToken = (token: string | null): void => {
  if (token === null) localStorage.removeItem('XUEBAN_TOKEN')
  else localStorage.setItem('XUEBAN_TOKEN', token)
}

export interface UserInfo {
  userId: string
  account: string
  name: string
  avatar?: string
  avatarNew?: string
  role?: string
  subject?: string
}

export const getUserInfo = (): UserInfo | null => {
  try {
    const stored = localStorage.getItem('userInfo')
    if (!stored) return null
    return JSON.parse(stored) as UserInfo
  } catch {
    return null
  }
}

export const setUserInfo = (userInfo: UserInfo | null): void => {
  try {
    if (userInfo === null) localStorage.removeItem('userInfo')
    else localStorage.setItem('userInfo', JSON.stringify(userInfo))
  } catch {
  }
}

export const isLoggedIn = (): boolean => {
  return !!getXuebanToken() && !!getUserId()
}

export const login = async (account: string, password: string): Promise<string> => {
  const response = await fetch('/xb-test/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  })

  const data = await response.json()

  if (!data.success) {
    throw new Error(data?.message || '登录失败')
  }

  const token = data?.data?.token
  if (!token) {
    throw new Error('登录失败：未获取到token')
  }

  localStorage.setItem('XUEBAN_TOKEN', token)
  localStorage.setItem('xuebanuserid', account)
  localStorage.setItem('userPassword', password)
  localStorage.setItem('lastLoginTime', Date.now().toString())

  // 获取用户信息（使用 header 认证）
  try {
    const userInfoResponse = await fetch(`/xb-test/admin/info?token=${token}`, {
      headers: {
        'Token': token,
        'sa-token': token,
        'authorization': token,
      },
    })
    const userInfoData = await userInfoResponse.json()
    if (userInfoData.success && userInfoData.data) {
      const userInfo = userInfoData.data.data
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
    }
  } catch (e) {
    console.warn('获取用户信息失败:', e)
  }

  return token
}

export const logout = (): void => {
  localStorage.removeItem('XUEBAN_TOKEN')
  localStorage.removeItem('xuebanuserid')
  localStorage.removeItem('userPassword')
  localStorage.removeItem('userInfo')
  localStorage.removeItem('lastLoginTime')
}

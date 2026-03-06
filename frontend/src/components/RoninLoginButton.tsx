import { Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { WalletOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/context'
import { useLanguage } from '../i18n/context'

function formatAddress(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function RoninLoginButton() {
  const { t } = useLanguage()
  const { address, isConnected, loading, error, connect, disconnect } = useAuth()

  const items: MenuProps['items'] = [
    {
      key: 'logout',
      label: t('authLogout'),
      onClick: disconnect,
    },
  ]

  if (isConnected && address) {
    return (
      <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
        <button
          type="button"
          className="app-header-lang-btn app-header-wallet-btn"
          style={{ gap: 6, display: 'flex', alignItems: 'center' }}
        >
          <WalletOutlined />
          <span>{formatAddress(address)}</span>
        </button>
      </Dropdown>
    )
  }

  const needInstall = error === 'PROVIDER_NOT_FOUND'
  return (
    <Button
      type="primary"
      size="small"
      icon={<WalletOutlined />}
      loading={loading}
      onClick={connect}
      className="app-header-connect-btn"
    >
      {needInstall ? t('authInstallRonin') : t('authConnectRonin')}
    </Button>
  )
}

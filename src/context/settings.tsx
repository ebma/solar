import React from "react"
import { testBiometricAuth, isBiometricAuthAvailable } from "../platform/bio-auth"
import {
  loadIgnoredSignatureRequestHashes,
  loadSettings,
  saveIgnoredSignatureRequestHashes,
  saveSettings
} from "../platform/settings"
import { trackError } from "./notifications"
import { useTranslation } from "react-i18next"

interface Props {
  children: React.ReactNode
}

interface ContextType {
  agreedToTermsAt: string | undefined
  biometricLock: boolean
  biometricAvailability: BiometricAvailability
  confirmToC: () => void
  ignoreSignatureRequest: (signatureRequestHash: string) => void
  ignoredSignatureRequests: string[]
  initialized: boolean
  multiSignature: boolean
  multiSignatureServiceURL: string
  showTestnet: boolean
  hideMemos: boolean
  toggleBiometricLock: () => void
  toggleMultiSignature: () => void
  toggleTestnet: () => void
  toggleHideMemos: () => void
}

interface SettingsState extends Platform.SettingsData {
  initialized: boolean
}

const initialSettings: SettingsState = {
  agreedToTermsAt: undefined,
  biometricLock: false,
  initialized: false,
  multisignature: false,
  testnet: false,
  hideMemos: false
}

const initialIgnoredSignatureRequests: string[] = []

const multiSignatureServiceURL = process.env.MULTISIG_SERVICE || "https://multisig.satoshipay.io/"

const SettingsContext = React.createContext<ContextType>({
  agreedToTermsAt: initialSettings.agreedToTermsAt,
  biometricLock: initialSettings.biometricLock,
  biometricAvailability: { available: false, enrolled: false },
  confirmToC: () => undefined,
  ignoreSignatureRequest: () => undefined,
  ignoredSignatureRequests: initialIgnoredSignatureRequests,
  initialized: false,
  multiSignature: initialSettings.multisignature,
  multiSignatureServiceURL,
  showTestnet: initialSettings.testnet,
  hideMemos: initialSettings.hideMemos,
  toggleBiometricLock: () => undefined,
  toggleMultiSignature: () => undefined,
  toggleTestnet: () => undefined,
  toggleHideMemos: () => undefined
})

export function SettingsProvider(props: Props) {
  const [ignoredSignatureRequests, setIgnoredSignatureRequests] = React.useState(initialIgnoredSignatureRequests)
  const [settings, setSettings] = React.useState<SettingsState>(initialSettings)
  const [biometricAvailability, setBiometricAvailability] = React.useState<BiometricAvailability>({
    available: false,
    enrolled: false
  })
  const { t } = useTranslation()

  React.useEffect(() => {
    Promise.all([loadIgnoredSignatureRequestHashes(), loadSettings()])
      .then(([loadedSignatureReqHashes, loadedSettings]) => {
        setIgnoredSignatureRequests(loadedSignatureReqHashes)
        setSettings({ ...settings, ...loadedSettings, initialized: true })
      })
      .catch(trackError)

    isBiometricAuthAvailable().then(setBiometricAvailability)

    // Can't really cancel loading the settings
    const unsubscribe = () => undefined
    return unsubscribe
  }, [])

  const ignoreSignatureRequest = (signatureRequestHash: string) => {
    if (ignoredSignatureRequests.indexOf(signatureRequestHash) === -1) {
      const updatedSignatureRequestHashes = [...ignoredSignatureRequests, signatureRequestHash]
      saveIgnoredSignatureRequestHashes(updatedSignatureRequestHashes)
      setIgnoredSignatureRequests(updatedSignatureRequestHashes)
    }
  }

  const updateSettings = (update: Partial<Platform.SettingsData>) => {
    try {
      const updatedSettings = {
        ...settings,
        ...update
      }
      setSettings(updatedSettings)
      saveSettings(updatedSettings)
    } catch (error) {
      trackError(error)
    }
  }

  const confirmToC = () => updateSettings({ agreedToTermsAt: new Date().toISOString() })
  const toggleMultiSignature = () => updateSettings({ multisignature: !settings.multisignature })
  const toggleTestnet = () => updateSettings({ testnet: !settings.testnet })
  const toggleHideMemos = () => updateSettings({ hideMemos: !settings.hideMemos })

  const toggleBiometricLock = () => {
    const message = settings.biometricLock
      ? t("app-settings.biometric-lock.prompt.disable")
      : t("app-settings.biometric-lock.prompt.enable")

    testBiometricAuth(message)
      .then(() => updateSettings({ biometricLock: !settings.biometricLock }))
      .catch(trackError)
  }

  const contextValue: ContextType = {
    agreedToTermsAt: settings.agreedToTermsAt,
    biometricLock: settings.biometricLock,
    biometricAvailability,
    confirmToC,
    ignoreSignatureRequest,
    ignoredSignatureRequests,
    initialized: settings.initialized,
    multiSignature: settings.multisignature,
    multiSignatureServiceURL,
    showTestnet: settings.testnet,
    hideMemos: settings.hideMemos,
    toggleBiometricLock,
    toggleMultiSignature,
    toggleTestnet,
    toggleHideMemos
  }

  return <SettingsContext.Provider value={contextValue}>{props.children}</SettingsContext.Provider>
}

export { ContextType as SettingsContextType, SettingsContext }

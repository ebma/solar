import React from "react"
import List from "@material-ui/core/List"
import { useIsMobile } from "~Generic/hooks/userinterface"
import { AccountCreation, AccountCreationErrors } from "../types/types"
import MultisigAccountPubKey from "./MultisigAccountPubKey"
import PasswordSetting from "./PasswordSetting"
import SecretKeyImport from "./SecretKeyImport"

interface NewAccountSettingsProps {
  accountCreation: AccountCreation
  errors: AccountCreationErrors
  onUpdateAccountCreation: (update: Partial<AccountCreation>) => void
}

function NewAccountSettings(props: NewAccountSettingsProps) {
  const { onUpdateAccountCreation } = props
  const isSmallScreen = useIsMobile()

  const toggleMultisigImport = React.useCallback(() => {
    onUpdateAccountCreation({ cosigner: !props.accountCreation.cosigner })
  }, [props.accountCreation.cosigner, onUpdateAccountCreation])

  const togglePasswordProtection = React.useCallback(() => {
    onUpdateAccountCreation({ requiresPassword: !props.accountCreation.requiresPassword })
  }, [props.accountCreation.requiresPassword, onUpdateAccountCreation])

  const updateMultisigAccount = React.useCallback(
    (accountPubKey: string) => {
      onUpdateAccountCreation({ cosignerOf: accountPubKey })
    },
    [onUpdateAccountCreation]
  )

  const toggleUseMnemonic = React.useCallback(
    (useMnemonic: boolean) => {
      onUpdateAccountCreation({ useMnemonic })
    },
    [onUpdateAccountCreation]
  )

  const updatePassword = React.useCallback(
    (password: string) => {
      onUpdateAccountCreation({ password })
    },
    [onUpdateAccountCreation]
  )

  const updateRepeatedPassword = React.useCallback(
    (repeatedPassword: string) => {
      onUpdateAccountCreation({ repeatedPassword })
    },
    [onUpdateAccountCreation]
  )

  const updateSecretKey = React.useCallback(
    (secretKey: string) => {
      onUpdateAccountCreation({ secretKey })
    },
    [onUpdateAccountCreation]
  )

  const updateMnemonic = React.useCallback(
    (mnemonic: string) => {
      onUpdateAccountCreation({ mnemonic })
    },
    [onUpdateAccountCreation]
  )

  const updatePasswordStrength = React.useCallback(
    (weakPassword: boolean) => {
      onUpdateAccountCreation({ weakPassword })
    },
    [onUpdateAccountCreation]
  )

  return (
    <List style={{ padding: isSmallScreen ? 0 : "24px 16px" }}>
      {props.accountCreation.import ? (
        <>
          <SecretKeyImport
            error={props.errors.secretKey}
            onEnterSecretKey={updateSecretKey}
            onEnterMnemonic={updateMnemonic}
            onToggleUseMnemonic={toggleUseMnemonic}
            secretKey={props.accountCreation.secretKey || ""}
            mnemonic={props.accountCreation.mnemonic || ""}
            useMnemonic={props.accountCreation.useMnemonic}
          />
          <MultisigAccountPubKey
            enabled={props.accountCreation.cosigner}
            import
            onEnter={updateMultisigAccount}
            onToggle={toggleMultisigImport}
            value={props.accountCreation.cosignerOf || ""}
          />
        </>
      ) : null}
      {props.accountCreation.cosigner && !props.accountCreation.import ? (
        <MultisigAccountPubKey enabled onEnter={updateMultisigAccount} value={props.accountCreation.cosignerOf || ""} />
      ) : null}
      <PasswordSetting
        error={props.errors.password}
        password={props.accountCreation.password}
        onEnterPassword={updatePassword}
        onRepeatPassword={updateRepeatedPassword}
        onTogglePassword={togglePasswordProtection}
        onPasswordStrengthChange={updatePasswordStrength}
        repeatedPassword={props.accountCreation.repeatedPassword}
        requiresPassword={props.accountCreation.requiresPassword}
      />
    </List>
  )
}

export default React.memo(NewAccountSettings)

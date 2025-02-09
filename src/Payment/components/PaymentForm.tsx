import InputAdornment from "@material-ui/core/InputAdornment"
import TextField from "@material-ui/core/TextField"
import SendIcon from "@material-ui/icons/Send"
import BigNumber from "big.js"
import nanoid from "nanoid"
import React from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Asset, FederationServer, Memo, MemoType, Server, Transaction } from "stellar-sdk"
import { Account } from "~App/contexts/accounts"
import { SettingsContext } from "~App/contexts/settings"
import AssetSelector from "~Generic/components/AssetSelector"
import CurrencySelector from "~Generic/components/CurrencySelector"
import { ActionButton, DialogActionsBox } from "~Generic/components/DialogActions"
import { MemoInput, PriceInput, QRReader } from "~Generic/components/FormFields"
import MemoSelector from "~Generic/components/MemoSelector"
import Portal from "~Generic/components/Portal"
import { useFederationLookup } from "~Generic/hooks/stellar"
import {
  AccountRecord,
  useAssetEstimate,
  useFiatEstimate,
  useWellKnownAccounts
} from "~Generic/hooks/stellar-ecosystem"
import { RefStateObject, useIsMobile } from "~Generic/hooks/userinterface"
import { AccountData } from "~Generic/lib/account"
import { formatBalance } from "~Generic/lib/balances"
import { CurrencyCode } from "~Generic/lib/currency-conversion"
import { FormBigNumber, isValidAmount, replaceCommaWithDot } from "~Generic/lib/form"
import { findMatchingBalanceLine, getAccountMinimumBalance, getSpendableBalance } from "~Generic/lib/stellar"
import { isPublicKey, isStellarAddress } from "~Generic/lib/stellar-address"
import { createPaymentOperation, createTransaction, multisigMinimumFee } from "~Generic/lib/transaction"
import { HorizontalLayout, VerticalLayout } from "~Layout/components/Box"

export interface PaymentFormValues {
  amount: string
  eventualAmount: string
  asset: Asset
  amountType: Asset | CurrencyCode
  destination: string
  memoType: MemoType
  memoValue: string
}

type ExtendedPaymentFormValues = PaymentFormValues & { memoType: MemoType }

interface MemoMetadata {
  label: string
  placeholder: string
  required: boolean
}

function createMemo(memoType: MemoType, memoValue: string) {
  switch (memoType) {
    case "id":
      return Memo.id(memoValue)
    case "text":
      return Memo.text(memoValue)
    default:
      return Memo.none()
  }
}

interface PaymentFormProps {
  accountData: AccountData
  actionsRef: RefStateObject
  onSubmit: (
    formValues: ExtendedPaymentFormValues,
    spendableBalance: BigNumber,
    wellknownAccount?: AccountRecord
  ) => void
  openOrdersCount: number
  testnet: boolean
  trustedAssets: Asset[]
  txCreationPending?: boolean
}

const PaymentForm = React.memo(function PaymentForm(props: PaymentFormProps) {
  const isSmallScreen = useIsMobile()
  const formID = React.useMemo(() => nanoid(), [])
  const { lookupFederationRecord } = useFederationLookup()

  const { t } = useTranslation()
  const wellknownAccounts = useWellKnownAccounts()

  const { preferredCurrency } = React.useContext(SettingsContext)

  const [matchingFederationRecord, setMatchingFederationRecord] = React.useState<FederationServer.Record | undefined>(
    undefined
  )
  const [matchingWellknownAccount, setMatchingWellknownAccount] = React.useState<AccountRecord | undefined>(undefined)
  const [memoMetadata, setMemoMetadata] = React.useState<MemoMetadata>({
    label: t("payment.memo-metadata.label.default"),
    placeholder: t("payment.memo-metadata.placeholder.optional"),
    required: false
  })
  const form = useForm<PaymentFormValues>({
    defaultValues: {
      amount: "",
      amountType: Asset.native(),
      eventualAmount: "",
      asset: Asset.native(),
      destination: "",
      memoType: "none",
      memoValue: ""
    }
  })

  const formValues = form.watch()
  const { setValue } = form

  const preferredCurrencyEstimate = useFiatEstimate(formValues.asset, preferredCurrency, props.testnet)
  const selectedCurrencyEstimate = useFiatEstimate(
    formValues.asset,
    formValues.amountType instanceof Asset ? preferredCurrency : formValues.amountType,
    props.testnet
  )
  const amountTypeToAssetEstimate = useAssetEstimate(
    formValues.amountType instanceof Asset ? preferredCurrency : formValues.amountType,
    formValues.asset,
    props.testnet
  )

  const spendableBalance =
    formValues.amountType instanceof Asset
      ? getSpendableBalance(
          getAccountMinimumBalance(props.accountData),
          findMatchingBalanceLine(props.accountData.balances, formValues.asset)
        )
      : selectedCurrencyEstimate.convertAmount(
          getSpendableBalance(
            getAccountMinimumBalance(props.accountData),
            findMatchingBalanceLine(props.accountData.balances, formValues.asset)
          )
        )

  React.useEffect(() => {
    // if asset is selected instead of currency replace it with the new one
    if (formValues.amountType instanceof Asset) {
      setValue("amountType", formValues.asset)
    }
  }, [formValues.amountType, formValues.asset, setValue])

  React.useEffect(() => {
    const eventualAmountValue =
      formValues.amountType === formValues.asset
        ? formValues.amount
        : amountTypeToAssetEstimate.convertAmount(Number(formValues.amount)).toFixed(2)

    setValue("eventualAmount", eventualAmountValue || "0.00")
  }, [amountTypeToAssetEstimate, formValues.amount, formValues.amountType, formValues.asset, setValue])

  React.useEffect(() => {
    if (isPublicKey(formValues.destination) || isStellarAddress(formValues.destination)) {
      wellknownAccounts.lookup(formValues.destination).then(setMatchingWellknownAccount)
    } else {
      setMatchingWellknownAccount(undefined)
    }
  }, [formValues.destination, wellknownAccounts])

  React.useEffect(() => {
    if (matchingWellknownAccount && matchingWellknownAccount.tags.indexOf("memo-required") !== -1) {
      setMemoMetadata({
        label: t("payment.memo-metadata.label.required"),
        placeholder: t("payment.memo-metadata.placeholder.mandatory"),
        required: true
      })
    } else {
      setMemoMetadata({
        label: t("payment.memo-metadata.label.default"),
        placeholder: t("payment.memo-metadata.placeholder.optional"),
        required: false
      })
    }
  }, [formValues.destination, formValues.memoValue, matchingWellknownAccount, t, wellknownAccounts])

  const handleFormSubmission = () => {
    props.onSubmit(form.getValues(), spendableBalance, matchingWellknownAccount)
  }

  React.useEffect(() => {
    if (matchingFederationRecord) {
      setValue("memoValue", matchingFederationRecord.memo)
      const requiredType =
        matchingFederationRecord.memo_type && !matchingFederationRecord.memo_type.toLowerCase().includes("text")
          ? "id"
          : "text"
      setValue("memoType", requiredType)
      setMemoMetadata({
        label: requiredType === "id" ? t("payment.memo-metadata.label.id") : t("payment.memo-metadata.label.text"),
        placeholder: t("payment.memo-metadata.placeholder.optional"),
        required: Boolean(requiredType)
      })
    }
  }, [matchingFederationRecord, setValue, t])

  const handleQRScan = React.useCallback(
    (scanResult: string) => {
      const [destination, query] = scanResult.split("?")
      setValue("destination", destination)

      if (!query) {
        return
      }

      const searchParams = new URLSearchParams(query)
      const memoValue = searchParams.get("dt")

      if (memoValue) {
        setValue("memoType", "id")
        setValue("memoValue", memoValue)
      }
    },
    [setValue]
  )

  const qrReaderAdornment = React.useMemo(
    () => (
      <InputAdornment disableTypography position="end">
        <QRReader onScan={handleQRScan} />
      </InputAdornment>
    ),
    [handleQRScan]
  )

  const destinationInput = React.useMemo(
    () => (
      <TextField
        autoFocus={process.env.PLATFORM !== "ios"}
        error={Boolean(form.errors.destination)}
        fullWidth
        inputProps={{
          style: { textOverflow: "ellipsis" }
        }}
        InputProps={{
          endAdornment: qrReaderAdornment
        }}
        inputRef={form.register({
          required: t<string>("payment.validation.no-destination"),
          validate: value =>
            (isStellarAddress(value) &&
              !Boolean(matchingFederationRecord) &&
              t<string>("payment.validation.stellar-address-not-found")) ||
            isPublicKey(value) ||
            isStellarAddress(value) ||
            t<string>("payment.validation.invalid-destination")
        })}
        label={form.errors.destination ? form.errors.destination.message : t("payment.inputs.destination.label")}
        margin="normal"
        name="destination"
        onChange={async event => {
          const destination = event.target.value.trim()
          setValue("destination", destination)
          try {
            const federationRecord = await lookupFederationRecord(destination)
            if (federationRecord && federationRecord.memo && federationRecord.memo_type) {
              setMatchingFederationRecord(federationRecord)
              form.triggerValidation("destination")
            } else {
              setMatchingFederationRecord(undefined)
            }
          } catch (error) {
            // check destination again because it might have changed by the time we receive this error
            if (destination === form.getValues().destination) {
              setMatchingFederationRecord(undefined)
            }
          }
        }}
        placeholder={t("payment.inputs.destination.placeholder")}
      />
    ),
    [form, lookupFederationRecord, matchingFederationRecord, qrReaderAdornment, setValue, t]
  )

  const assetSelector = React.useMemo(
    () => (
      <Controller
        as={
          <AssetSelector
            assets={props.accountData.balances}
            disableUnderline
            inputStyle={{
              fontSize: "x-large"
            }}
            showXLM
            style={{ alignSelf: "center" }}
            testnet={props.testnet}
            value={formValues.asset}
          />
        }
        control={form.control}
        name="asset"
      />
    ),
    [form, formValues.asset, props.accountData.balances, props.testnet]
  )

  const currencySelector = React.useMemo(
    () => (
      <Controller
        as={
          <CurrencySelector
            asset={formValues.asset}
            disableUnderline
            style={{ alignSelf: "center" }}
            testnet={props.testnet}
          />
        }
        control={form.control}
        name="amountType"
      />
    ),
    [form, formValues.asset, props.testnet]
  )

  const amountInput = React.useMemo(
    () => (
      <PriceInput
        selector={currencySelector}
        error={Boolean(form.errors.amount)}
        inputRef={form.register({
          required: t<string>("payment.validation.no-price"),
          validate: value => {
            if (!isValidAmount(value) || FormBigNumber(value).eq(0)) {
              return t<string>("payment.validation.invalid-price")
            } else if (FormBigNumber(value).gt(spendableBalance)) {
              return t<string>("payment.validation.not-enough-funds")
            } else {
              return undefined
            }
          }
        })}
        label={form.errors.amount ? form.errors.amount.message : t("payment.inputs.price.label")}
        margin="normal"
        name="amount"
        placeholder={t("payment.inputs.price.placeholder", `Max. ${formatBalance(spendableBalance.toString())}`, {
          amount: formatBalance(spendableBalance.toString())
        })}
        style={{
          flexGrow: isSmallScreen ? 1 : undefined,
          marginLeft: 24,
          marginRight: 24,
          minWidth: 230,
          maxWidth: isSmallScreen ? undefined : "60%"
        }}
      />
    ),
    [currencySelector, form, isSmallScreen, spendableBalance, t]
  )

  const eventualAmountInput = React.useMemo(() => {
    const amountInPreferredCurrency = preferredCurrencyEstimate.convertAmount(
      formValues.asset === formValues.amountType
        ? Number(formValues.amount)
        : amountTypeToAssetEstimate.convertAmount(Number(formValues.amount))
    )

    return (
      <PriceInput
        selector={assetSelector}
        disabled
        helperText={
          formValues.amount
            ? `~ ${amountInPreferredCurrency.toFixed(2)} ${preferredCurrency}`
            : t("payment.inputs.eventual-price.helper")
        }
        margin="normal"
        name="eventualAmount"
        inputRef={form.register()}
        InputProps={{
          disableUnderline: true,
          inputProps: {
            style: { textAlign: "right", fontSize: "x-large" }
          }
        }}
        FormHelperTextProps={{
          style: { textAlign: "center" }
        }}
        style={{
          flexGrow: isSmallScreen ? 1 : undefined,
          marginLeft: 24,
          marginRight: 24
        }}
        variant="standard"
      />
    )
  }, [
    assetSelector,
    amountTypeToAssetEstimate,
    form,
    formValues.amount,
    formValues.amountType,
    formValues.asset,
    isSmallScreen,
    preferredCurrency,
    preferredCurrencyEstimate,
    t
  ])

  const memoSelector = React.useMemo(
    () => (
      <Controller
        as={<MemoSelector disableUnderline value={formValues.memoType} />}
        control={form.control}
        name="memoType"
      />
    ),
    [form.control, formValues.memoType]
  )

  const memoInput = React.useMemo(
    () => (
      <MemoInput
        disabled={Boolean(matchingFederationRecord)}
        memoSelector={memoSelector}
        error={Boolean(form.errors.memoValue)}
        inputProps={{ maxLength: 28 }}
        label={form.errors.memoValue ? form.errors.memoValue.message : memoMetadata.label}
        margin="normal"
        name="memoValue"
        inputRef={form.register({
          validate: {
            length: value => value.length <= 28 || t<string>("payment.validation.memo-too-long"),
            memoRequired: value =>
              !memoMetadata.required ||
              !matchingWellknownAccount ||
              value.length > 0 ||
              t<string>(
                "payment.validation.memo-required",
                `Set a memo when sending funds to ${matchingWellknownAccount.name}`,
                {
                  destination: matchingWellknownAccount.name
                }
              ),
            idPattern: value =>
              formValues.memoType !== "id" ||
              value.match(/^[0-9]+$/) ||
              t<string>("payment.validation.integer-memo-required")
          }
        })}
        onChange={event => {
          const { value } = event.target
          const newMemoType =
            value.length === 0 ? "none" : formValues.memoType === "none" ? "text" : formValues.memoType
          setValue("memoType", newMemoType)
          setValue("memoValue", value)
        }}
        placeholder={memoMetadata.placeholder}
        style={{
          flexGrow: 1,
          marginLeft: 24,
          marginRight: 24,
          minWidth: 230
        }}
      />
    ),
    [
      form,
      matchingFederationRecord,
      formValues.memoType,
      matchingWellknownAccount,
      memoSelector,
      memoMetadata.label,
      memoMetadata.placeholder,
      memoMetadata.required,
      setValue,
      t
    ]
  )

  const dialogActions = React.useMemo(
    () => (
      <DialogActionsBox desktopStyle={{ marginTop: 64 }}>
        <ActionButton
          form={formID}
          icon={<SendIcon style={{ fontSize: 16 }} />}
          loading={props.txCreationPending}
          onClick={() => undefined}
          testnet={props.testnet}
          type="submit"
        >
          {t("payment.actions.submit")}
        </ActionButton>
      </DialogActionsBox>
    ),
    [formID, props.testnet, props.txCreationPending, t]
  )

  return (
    <form id={formID} noValidate onSubmit={form.handleSubmit(handleFormSubmission)}>
      {destinationInput}
      <HorizontalLayout justifyContent="space-between" alignItems="center" margin="0 -24px" wrap="wrap">
        {amountInput}
        {memoInput}
      </HorizontalLayout>
      <VerticalLayout justifyContent="center" style={{ marginTop: 16 }}>
        <div style={{ alignSelf: "center" }}>{eventualAmountInput}</div>
      </VerticalLayout>
      <Portal target={props.actionsRef.element}>{dialogActions}</Portal>
    </form>
  )
})

interface Props {
  accountData: AccountData
  actionsRef: RefStateObject
  openOrdersCount: number
  testnet: boolean
  trustedAssets: Asset[]
  txCreationPending?: boolean
  onCancel: () => void
  onSubmit: (createTx: (horizon: Server, account: Account) => Promise<Transaction>) => any
}

function PaymentFormContainer(props: Props) {
  const { lookupFederationRecord } = useFederationLookup()

  const createPaymentTx = async (horizon: Server, account: Account, formValues: ExtendedPaymentFormValues) => {
    const asset = props.trustedAssets.find(trustedAsset => trustedAsset.equals(formValues.asset))
    const federationRecord =
      formValues.destination.indexOf("*") > -1 ? await lookupFederationRecord(formValues.destination) : null
    const destination = federationRecord ? federationRecord.account_id : formValues.destination
    const memo = createMemo(formValues.memoType, formValues.memoValue)

    const isMultisigTx = props.accountData.signers.length > 1

    const payment = await createPaymentOperation({
      asset: asset || Asset.native(),
      amount: replaceCommaWithDot(formValues.eventualAmount),
      destination,
      horizon
    })
    const tx = await createTransaction([payment], {
      accountData: props.accountData,
      memo,
      minTransactionFee: isMultisigTx ? multisigMinimumFee : 0,
      horizon,
      walletAccount: account
    })
    return tx
  }

  const submitForm = (formValues: ExtendedPaymentFormValues) => {
    props.onSubmit((horizon, account) => createPaymentTx(horizon, account, formValues))
  }

  return <PaymentForm {...props} onSubmit={submitForm} />
}

export default React.memo(PaymentFormContainer)

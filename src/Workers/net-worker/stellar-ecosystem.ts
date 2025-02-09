import { FederationServer, StellarTomlResolver } from "stellar-sdk"
import { AccountRecord } from "~Generic/lib/stellar-expert"
import { AssetRecord } from "~Generic/lib/stellar-ticker"
import { CurrencyCode, QuoteRecord } from "~Generic/lib/currency-conversion"
import { CustomError } from "~Generic/lib/errors"

export async function fetchWellknownAccount(accountID: string): Promise<AccountRecord | null> {
  const requestURL = "https://api.stellar.expert/api/explorer/directory" + `?address[]=${accountID}`

  const response = await fetch(requestURL)

  if (response.status >= 400) {
    throw CustomError("BadResponseError", `Bad response (${response.status}) from stellar.expert server`, {
      status: response.status,
      server: "stellar.expert"
    })
  }

  const json = await response.json()
  const knownAccounts = json._embedded.records as AccountRecord[]
  const account = knownAccounts.length > 0 ? knownAccounts[0] : null
  return account
}

function byAccountCountSorter(a: AssetRecord, b: AssetRecord) {
  return b.num_accounts - a.num_accounts
}

function trimAccountRecord(record: AssetRecord) {
  return {
    code: record.code,
    desc: record.desc,
    issuer: record.issuer,
    issuer_detail: {
      name: record.issuer_detail.name,
      url: record.issuer_detail.url
    },
    name: record.name,
    num_accounts: record.num_accounts,
    status: record.status,
    type: record.type
  }
}

export async function fetchAllAssets(tickerURL: string): Promise<AssetRecord[]> {
  const requestURL = new URL("/assets.json", tickerURL)
  const response = await fetch(String(requestURL))

  if (response.status >= 400) {
    throw CustomError("BadResponseError", `Bad response (${response.status}) from stellar.expert server`, {
      status: response.status,
      server: "stellar.expert"
    })
  }

  const json = await response.json()
  const allAssets = json.assets as AssetRecord[]
  const abbreviatedAssets = allAssets.sort(byAccountCountSorter).map(record => trimAccountRecord(record))
  return abbreviatedAssets
}

export async function fetchStellarToml(
  domain: string,
  options: StellarTomlResolver.StellarTomlResolveOptions = {}
): Promise<any> {
  try {
    return await StellarTomlResolver.resolve(domain, options)
  } catch (error) {
    // tslint:disable-next-line no-console
    console.warn(`Could not resolve stellar.toml data for domain ${domain}:`, error)
    return undefined
  }
}

export function resolveStellarAddress(address: string, options?: FederationServer.Options) {
  return FederationServer.resolve(address, options)
}

export async function fetchCryptoPrice(currencyCode: CurrencyCode, testnet: boolean) {
  const baseURL = testnet
    ? "https://api.satoshipay.io/testnet/coinmarketcap/v1/cryptocurrency/quotes/latest"
    : "https://api.satoshipay.io/mainnet/coinmarketcap/v1/cryptocurrency/quotes/latest"

  const requestURL = `${baseURL}?symbol=XLM&convert=${currencyCode}`

  const response = await fetch(requestURL)

  if (response.status >= 400) {
    throw Error(`Bad response (${response.status}) from conversion rate endpoint`)
  }

  const json = await response.json()
  const quoteRecord = json.data.XLM.quote[currencyCode] as QuoteRecord
  return quoteRecord
}

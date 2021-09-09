export interface AccountCreation {
  cosigner: boolean
  cosignerOf?: string
  import: boolean
  mnemonic?: string
  name: string
  password: string
  repeatedPassword: string
  requiresPassword: boolean
  secretKey?: string
  testnet: boolean
  useMnemonic: boolean
  weakPassword: boolean
}

export interface AccountCreationErrors {
  name?: string
  password?: string
  secretKey?: string
}

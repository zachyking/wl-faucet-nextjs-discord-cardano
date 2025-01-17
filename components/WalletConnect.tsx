import React, { useState, useContext, Fragment } from 'react'
import CardanoWallet from "../cardano/cardano-wallet"
import loader from '../cardano/cardano-wallet/loader'
import { Buffer } from 'buffer'
import WalletDropdown from './WalletDropdown'
import { useToast } from '../hooks/useToast';
import Checkbox from "../components/Checkbox";
import { BigNum } from '@emurgo/cardano-serialization-lib-browser'

let wallet
const _Buffer = Buffer

export default function WalletConnect({successCallback} : {successCallback: (txid: any) => void}) {
    const [address, setAddress] = useState('')
    const [connected, setConnected] = useState(false)
    const [walletState, setWalletState] = useState()
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(true)
    const toast = useToast(3000);

    // const walletCtx = useContext(WalletContext)

    const setAddressBech32 = async (walletApi) => {
        if(walletApi) {
            await loader.load()
            const loaded = typeof loader !== 'undefined'
            console.log("loader")
            console.log(loaded)
            if(loaded) {
                const loadedLoader = loader
                const address = (await walletApi.getUsedAddresses())[0]
                const addReadable = loadedLoader.Cardano.Address.from_bytes(_Buffer.from(address, 'hex')).to_bech32()
                console.log(addReadable)
                setAddress(addReadable)
            }
        }
    }

    const checkboxData = (checkHandler) => {
        setResult(checkHandler)
        console.log(result)
    }

    const makeTx = async () => {
        setLoading(true)
        let blockfrostApiKey = {
            0: "testneto48QlLzZUqe1bLNas393LNKOAzAsJNOE", // testnet
            1: "mainnetlBYozUOJH7r3Lm0p7qarAwvxQRTWZSRY" // mainnet
            }
        
        const loaded = typeof loader !== 'undefined'

        if(!loaded) {
            await loader.load()
        }
        const S = loader.Cardano
        wallet = new CardanoWallet(
                        S,
                        walletState,
                        blockfrostApiKey
                    )
        let utxos = await wallet.getUtxosHex();
        console.log(utxos)
        const res = await fetch(`/api/utxos/available`).then(res => res.text())
        if(res.includes('ERROR')) return toast('error', res)
        console.log('res')
        console.log(res)
        utxos = utxos.concat(res)
        const myAddress = await wallet.getAddress();
        const netId = await wallet.getNetworkId();

        let data =  (await wallet.getBalance()).assets
        const localAssetCheck = '648823ffdad1610b4162f4dbc87bd47f6f9cf45d772ddef661eff19877444f4745'
        const checkUserAssets = data.filter(input => input.unit == localAssetCheck)
        const quantityUser = checkUserAssets.length > 0 ? checkUserAssets[0].quantity : 0
        const parseAmount = parseInt(quantityUser) + 5
        const claimAmount = parseAmount.toString()
        console.log('claimAmount')
        console.log(claimAmount)

        const serverUtxoMultiasset = S.TransactionUnspentOutput.from_bytes(Buffer.from(res, 'hex')).output().amount().multiasset()
        const serverUtxoMultiassetQt = unitCountInMultiassets(serverUtxoMultiasset, "648823ffdad1610b4162f4dbc87bd47f6f9cf45d772ddef661eff198.wDOGE" )
        const giveAmount = (serverUtxoMultiassetQt - 5).toString()


        let recipients = [
            // User Wallet
            // NFTs to be sent - Calculate all OG tokens in users wallet, sent it to him, plus amount he is claiming
            {address: `${myAddress}`,  amount: "2.5",
            assets:[{"unit":"648823ffdad1610b4162f4dbc87bd47f6f9cf45d772ddef661eff198.wDOGE","quantity":claimAmount}] // TODO - The unit needs to not be like this format.
            },

            // Server Address - Calculate all OG token in server address, sent it back minus what's going to user
            // NFTs to be sent
            {address: "addr_test1vpeer9pltfdzalkk4psyxvc59pwxy9njf0zsk095zkutu8gcwx60f", amount: "0",
            assets:[{"unit":"648823ffdad1610b4162f4dbc87bd47f6f9cf45d772ddef661eff198.wDOGE","quantity":giveAmount}]}
        ]
        try {
            const t = await wallet.transaction({
                PaymentAddress: myAddress,
                utxosRaw: utxos,
                recipients: recipients,
                addMetadata: false,
                multiSig: true,
                networkId: netId.id,
                ttl: 18000
            })
         
            const signature = await wallet.signTx(t, true)
            const submitRes = await fetch(`/api/submit/${t}/${signature}`).then(res => res.json())

            if(submitRes.txhash !== '') {
                successCallback(submitRes.txhash)
            }
            // const res = 'res-temp'
            // const txhash = await wallet.submitTx({transactionRaw: t, witnesses: [signature], networkId: 1})
            const resTxId = submitRes.txhash
            toast('success', `Transaction ID ${resTxId}`)
            return res

        } catch(err){
            console.log(err)
            toast('error', err.toString())
        }
        toast('error', "Transaction Cancelled")
        setLoading(false)
    }

    const enableCardano = async (wallet = 'nami') => {
        const win:any = window

        if(!win.cardano) return
  
        let baseWalletApi, fullWalletApi
        switch(wallet){
          case 'nami':
            baseWalletApi = win.cardano.nami
            break
          case 'ccvault':
            baseWalletApi = win.cardano.ccvault
            break
          case 'flint':
            baseWalletApi = win.cardano.flint
            break
        default:
            break
        }
  
        switch(wallet){
          case 'nami':
            fullWalletApi = await baseWalletApi.enable()
            break
          case 'ccvault':
            fullWalletApi = await baseWalletApi.enable()
            break
          case 'flint':
            fullWalletApi = await baseWalletApi.enable()
            break
          default:
            break
        }

        if(!await baseWalletApi.isEnabled()) return
        else {
            console.log(fullWalletApi)
            wallet = fullWalletApi
            setWalletState(fullWalletApi)
            setConnected(true)
            setAddressBech32(fullWalletApi)
            
        }
    }

    return (
           <div style={{flexDirection: "column"}} className="flex items-center justify-center space-x-2">
            <div className="flex">   
                {connected ? 
                    loading ?
                    <>
                        <div className="flex items-center justify-center space-x-2">
                        <div className="spinner-grow inline-block w-8 h-8 bg-current rounded-full opacity-0 text-blue-300" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        </div>
                    </>
                    : 
                    <div>
                        <button onClick={() => {result == true ? toast("error", "Accept the Terms of Service to Claim") : makeTx(); setResult(true)}}
                            className="m-2 p-10 text-black font-bold rounded-xl transition-all duration-500 bg-gradient-to-br to-blue-500 via-white from-blue-900 bg-size-200 bg-pos-0 hover:bg-pos-100">
                        <h2>
                            Claim
                        </h2>
                        </button>
                        <Checkbox checkboxData={checkboxData}/>
                    </div>
                    
                :
                <></>
                }
            </div>
            <WalletDropdown enableWallet={enableCardano} address={address}/>
        </div>
    )
}

const unitCountInMultiassets = (multiAssets, unit) => {
    let count = 0
    let multiAssetKeys = multiAssets.keys();
    for (let assetsKeyIndex of [
        ...Array(multiAssetKeys.len()).keys(),
      ]) {
        let assetsKey = multiAssetKeys.get(assetsKeyIndex);
        let assets = multiAssets.get(assetsKey);
        let assetKeys = assets.keys();
        let policyId = Buffer.from(assetsKey.to_bytes()).toString('hex');
        for (let assetKeyIndex of [...Array(assetKeys.len()).keys()]) {
            let asset = assetKeys.get(assetKeyIndex);
            let assetNum: BigNum = assets.get(asset);
            let un =
                policyId +
                '.' +
                Buffer.from((Buffer.from(asset.name()).toString('hex')), 'hex').toString('ascii')
            if (unit === un) count += Number(assetNum.to_str())
        }
    }
    return count
}
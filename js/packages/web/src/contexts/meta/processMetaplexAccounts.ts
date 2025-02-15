import { programIds, cache, ParsedAccount, METAPLEX_ID } from '@oyster/common';
import { AccountInfo, PublicKey } from '@solana/web3.js';
import {
  AuctionManagerV2,
  BidRedemptionTicket,
  decodeAuctionManager,
  decodeBidRedemptionTicket,
  decodeStore,
  decodeWhitelistedCreator,
  getWhitelistedCreator,
  MetaplexKey,
  Store,
  WhitelistedCreator,
  WhitelistedCreatorParser,
  PayoutTicket,
  decodePayoutTicket,
  PrizeTrackingTicket,
  decodePrizeTrackingTicket,
  BidRedemptionTicketV2,
  decodeSafetyDepositConfig,
  SafetyDepositConfig,
} from '../../models/metaplex';
import { AuctionManagerV1 } from '../../models/metaplex/deprecatedStates';
import names from '../../config/userNames.json';
import { ProcessAccountsFunc } from './types';

export const processMetaplexAccounts: ProcessAccountsFunc = async (
  { account, pubkey },
  setter,
  useAll,
) => {
  if (!isMetaplexAccount(account)) return;

  try {
    const STORE_ID = programIds().store;

    if (
      isAuctionManagerV1Account(account) ||
      isAuctionManagerV2Account(account)
    ) {
      const storeKey = new PublicKey(account.data.slice(1, 33));

      if ((STORE_ID && storeKey.equals(STORE_ID)) || useAll) {
        const auctionManager = decodeAuctionManager(account.data);

        const parsedAccount: ParsedAccount<
          AuctionManagerV1 | AuctionManagerV2
        > = {
          pubkey,
          account,
          info: auctionManager,
        };
        setter(
          'auctionManagersByAuction',
          auctionManager.auction.toBase58(),
          parsedAccount,
        );
      }
    }

    if (
      isBidRedemptionTicketV1Account(account) ||
      isBidRedemptionTicketV2Account(account)
    ) {
      const ticket = decodeBidRedemptionTicket(account.data);
      const parsedAccount: ParsedAccount<BidRedemptionTicket> = {
        pubkey,
        account,
        info: ticket,
      };
      setter('bidRedemptions', pubkey.toBase58(), parsedAccount);

      if (ticket.key == MetaplexKey.BidRedemptionTicketV2) {
        const asV2 = ticket as BidRedemptionTicketV2;
        if (asV2.winnerIndex) {
          setter(
            'bidRedemptionV2sByAuctionManagerAndWinningIndex',
            asV2.auctionManager.toBase58() + '-' + asV2.winnerIndex.toNumber(),
            parsedAccount,
          );
        }
      }
    }

    if (isPayoutTicketV1Account(account)) {
      const ticket = decodePayoutTicket(account.data);
      const parsedAccount: ParsedAccount<PayoutTicket> = {
        pubkey,
        account,
        info: ticket,
      };
      setter('payoutTickets', pubkey.toBase58(), parsedAccount);
    }

    if (isPrizeTrackingTicketV1Account(account)) {
      const ticket = decodePrizeTrackingTicket(account.data);
      const parsedAccount: ParsedAccount<PrizeTrackingTicket> = {
        pubkey,
        account,
        info: ticket,
      };
      setter('prizeTrackingTickets', pubkey.toBase58(), parsedAccount);
    }

    if (isStoreV1Account(account)) {
      const store = decodeStore(account.data);
      const parsedAccount: ParsedAccount<Store> = {
        pubkey,
        account,
        info: store,
      };
      if (STORE_ID && pubkey.equals(STORE_ID)) {
        setter('store', pubkey.toBase58(), parsedAccount);
      }
      setter('stores', pubkey.toBase58(), parsedAccount);
    }

    if (isSafetyDepositConfigV1Account(account)) {
      const config = decodeSafetyDepositConfig(account.data);
      const parsedAccount: ParsedAccount<SafetyDepositConfig> = {
        pubkey,
        account,
        info: config,
      };
      setter(
        'safetyDepositConfigsByAuctionManagerAndIndex',
        config.auctionManager.toBase58() + '-' + config.order.toNumber(),
        parsedAccount,
      );
    }

    if (isWhitelistedCreatorV1Account(account)) {
      const whitelistedCreator = decodeWhitelistedCreator(account.data);

      // TODO: figure out a way to avoid generating creator addresses during parsing
      // should we store store id inside creator?
      const creatorKeyIfCreatorWasPartOfThisStore = await getWhitelistedCreator(
        whitelistedCreator.address,
      );

      if (creatorKeyIfCreatorWasPartOfThisStore.equals(pubkey)) {
        const parsedAccount = cache.add(
          pubkey,
          account,
          WhitelistedCreatorParser,
          false,
        ) as ParsedAccount<WhitelistedCreator>;

        const nameInfo = (names as any)[parsedAccount.info.address.toBase58()];

        if (nameInfo) {
          parsedAccount.info = { ...parsedAccount.info, ...nameInfo };
        }

        setter(
          'whitelistedCreatorsByCreator',
          whitelistedCreator.address.toBase58(),
          parsedAccount,
        );
      }
    }
  } catch {
    // ignore errors
    // add type as first byte for easier deserialization
  }
};

const isMetaplexAccount = (account: AccountInfo<Buffer>) =>
  account.owner.equals(METAPLEX_ID);

const isAuctionManagerV1Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.AuctionManagerV1;

const isAuctionManagerV2Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.AuctionManagerV2;

const isBidRedemptionTicketV1Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.BidRedemptionTicketV1;

const isBidRedemptionTicketV2Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.BidRedemptionTicketV2;

const isPayoutTicketV1Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.PayoutTicketV1;

const isPrizeTrackingTicketV1Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.PrizeTrackingTicketV1;

const isStoreV1Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.StoreV1;

const isSafetyDepositConfigV1Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.SafetyDepositConfigV1;

const isWhitelistedCreatorV1Account = (account: AccountInfo<Buffer>) =>
  account.data[0] === MetaplexKey.WhitelistedCreatorV1;

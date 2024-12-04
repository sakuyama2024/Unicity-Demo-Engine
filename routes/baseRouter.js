"use strict";

const debug = require("debug");
const debugLog = debug("btcexp:router");

const express = require('express');
const csrfApi = require('csurf');
const router = express.Router();
const util = require('util');
const moment = require('moment');
const qrcode = require('qrcode');
const bitcoinjs = require('bitcoinjs-lib');
const bip32 = require('bip32');
const bs58check = require('bs58check');
const { bech32, bech32m } = require("bech32");
const sha256 = require("crypto-js/sha256");
const hexEnc = require("crypto-js/enc-hex");
const Decimal = require("decimal.js");
const semver = require("semver");
const markdown = require("markdown-it")();
const asyncHandler = require("express-async-handler");

const utils = require('./../app/utils.js');
const coins = require("./../app/coins.js");
const config = require("./../app/config.js");
const coreApi = require("./../app/api/coreApi.js");
const rpcApi = require("./../app/api/rpcApi.js");


const forceCsrf = csrfApi({ ignoreMethods: [] });

let noTxIndexMsg = "\n\nYour node does not have **txindex** enabled. Without it, you can only lookup wallet, mempool, and recently confirmed transactions by their **txid**. Searching for non-wallet transactions that were confirmed more than "+config.noTxIndexSearchDepth+" blocks ago is only possible if the confirmed block height is available.";

router.get("/", asyncHandler(async (req, res, next) => {
	try {
		if (req.session.host == null || req.session.host.trim() == "") {
			if (req.cookies['rpc-host']) {
				res.locals.host = req.cookies['rpc-host'];
			}

			if (req.cookies['rpc-port']) {
				res.locals.port = req.cookies['rpc-port'];
			}

			if (req.cookies['rpc-username']) {
				res.locals.username = req.cookies['rpc-username'];
			}

			res.render("connect");
			res.end();

			return;
		}

		const { perfId, perfResults } = utils.perfLogNewItem({action:"homepage"});
		res.locals.perfId = perfId;

		res.locals.homepage = true;
		
		// don't need timestamp on homepage "blocks-list", this flag disables
		res.locals.hideTimestampColumn = true;


		// variables used by blocks-list.pug
		res.locals.offset = 0;
		res.locals.sort = "desc";

		let feeConfTargets = [1, 6, 144, 1008];
		res.locals.feeConfTargets = feeConfTargets;


		let promises = [];

		promises.push(utils.timePromise("homepage.getMempoolInfo", async () => {
			res.locals.mempoolInfo = await coreApi.getMempoolInfo();
		}, perfResults));

		promises.push(utils.timePromise("homepage.getMiningInfo", async () => {
			res.locals.miningInfo = await coreApi.getMiningInfo();
		}, perfResults));

		promises.push(utils.timePromise("peers.getPeerSummary", async () => {
			res.locals.peerSummary = await coreApi.getPeerSummary();
		}, perfResults));

		promises.push(utils.timePromise("homepage.getSmartFeeEstimates", async () => {
			const rawSmartFeeEstimates = await coreApi.getSmartFeeEstimates("CONSERVATIVE", feeConfTargets);

			let smartFeeEstimates = {};

			for (let i = 0; i < feeConfTargets.length; i++) {
				let rawSmartFeeEstimate = rawSmartFeeEstimates[i];

				if (rawSmartFeeEstimate.errors) {
					smartFeeEstimates[feeConfTargets[i]] = "?";

				} else {
					smartFeeEstimates[feeConfTargets[i]] = parseInt(new Decimal(rawSmartFeeEstimate.feerate).times(coinConfig.baseCurrencyUnit.multiplier).dividedBy(1000));
				}
			}

			res.locals.smartFeeEstimates = smartFeeEstimates;
		}, perfResults));

		promises.push(utils.timePromise("homepage.getNetworkHashrate", async () => {
			res.locals.hashrate7d = await coreApi.getNetworkHashrate(1008);
		}, perfResults));

		promises.push(utils.timePromise("homepage.getNetworkHashrate", async () => {
			res.locals.hashrate30d = await coreApi.getNetworkHashrate(4320);
		}, perfResults));

		promises.push(utils.timePromise("homepage.getCommunityBalance", async () => {
			res.locals.communityBalance = await coreApi.getCommunityBalance();
		}, perfResults));



		const getblockchaininfo = await utils.timePromise("homepage.getBlockchainInfo", async () => {
			return await coreApi.getBlockchainInfo();
		}, perfResults);


		res.locals.getblockchaininfo = getblockchaininfo;

		res.locals.difficultyPeriod = parseInt(Math.floor(getblockchaininfo.blocks / coinConfig.difficultyAdjustmentBlockCount));
			



		let blockHeights = [];
		if (getblockchaininfo.blocks) {

			const currentHeight = getblockchaininfo.blocks;
			// +1 to page size here so we have the next block to calculate T.T.M.
			for (let i = 0; i < (config.site.homepage.recentBlocksCount + 1); i++) {
				blockHeights.push(getblockchaininfo.blocks - i);
			}
			// Add boundary blocks needed for averages
			blockHeights.push(currentHeight - 5);
			blockHeights.push(currentHeight - 20);
			blockHeights.push(currentHeight - 100);
			blockHeights.push(currentHeight - 1000);

		} 

		promises.push(utils.timePromise("homepage.getBlocksStatsByHeight", async () => {
			const rawblockstats = await coreApi.getBlocksStatsByHeight(blockHeights);

			if (rawblockstats && rawblockstats.length > 0 && rawblockstats[0] != null) {
				res.locals.blockstatsByHeight = {};

				for (let i = 0; i < rawblockstats.length; i++) {
					let blockstats = rawblockstats[i];

					res.locals.blockstatsByHeight[blockstats.height] = blockstats;
				}
			}
		}, perfResults));

		promises.push(utils.timePromise("homepage.getBlockHeaderByHeight", async () => {
			let h = coinConfig.difficultyAdjustmentBlockCount * res.locals.difficultyPeriod;
			res.locals.difficultyPeriodFirstBlockHeader = await coreApi.getBlockHeaderByHeight(h);
		}, perfResults));

		
		promises.push(utils.timePromise("homepage.getBlocksByHeight", async () => {
			const blocks = await coreApi.getBlocksByHeight(blockHeights);
			
			// Store blocks by height for easy lookup
			const blocksByHeight = {};
			blocks.forEach(block => {
				blocksByHeight[block.height] = block;
			});
			
			res.locals.latestBlocks = blocks.slice(0, config.site.homepage.recentBlocksCount + 1);
			res.locals.blocksUntilDifficultyAdjustment = ((res.locals.difficultyPeriod + 1) * coinConfig.difficultyAdjustmentBlockCount) - blocks[0].height;

			// Calculate average times using boundary blocks
			const currentHeight = getblockchaininfo.blocks;
			const calculateAverage = (blockCount) => {
				const startBlock = blocksByHeight[currentHeight];
				const endBlock = blocksByHeight[currentHeight - blockCount];
				
				if (!startBlock || !endBlock) return null;
				
				const timeDiff = startBlock.time - endBlock.time;
				const average = timeDiff / blockCount;
				console.log("average", average);
				return average;
			};

			// Calculate and store average block times
			res.locals.averageBlockTimes = {
				last5: calculateAverage(5),
				last20: calculateAverage(20),
				last100: calculateAverage(100),
				last1000: calculateAverage(1000)
			};
		}, perfResults));

		
		let targetBlocksPerDay = 24 * 60 * 60 / global.coinConfig.targetBlockTimeSeconds;
		res.locals.targetBlocksPerDay = targetBlocksPerDay;


		await utils.awaitPromises(promises);



		let eraStartBlockHeader = res.locals.difficultyPeriodFirstBlockHeader;
		let currentBlock = res.locals.latestBlocks[0];

		res.locals.difficultyAdjustmentData = utils.difficultyAdjustmentEstimates(eraStartBlockHeader, currentBlock);

		res.locals.nextHalvingData = utils.nextHalvingEstimates(
			res.locals.difficultyPeriodFirstBlockHeader,
			res.locals.latestBlocks[0],
			res.locals.difficultyAdjustmentData);



		res.locals.perfResults = perfResults;


		await utils.timePromise("homepage.render", async () => {
			res.render("index");
		}, perfResults);

		next();

	} catch (err) {
		utils.logError("238023hw87gddd", err);
					
		res.locals.userMessage = "Error building page: " + err;

		await utils.timePromise("homepage.render", async () => {
			res.render("index");
		});

		next();
	}
}));


router.post("/connect", function(req, res, next) {
	let host = req.body.host;
	let port = req.body.port;
	let username = req.body.username;
	let password = req.body.password;

	res.cookie('rpc-host', host);
	res.cookie('rpc-port', port);
	res.cookie('rpc-username', username);

	req.session.host = host;
	req.session.port = port;
	req.session.username = username;

	let newClient = new bitcoinCore({
		host: host,
		port: port,
		username: username,
		password: password,
		timeout: 30000
	});

	debugLog("created new rpc client: " + newClient);

	global.rpcClient = newClient;

	req.session.userMessage = "<span class='font-weight-bold'>Connected via RPC</span>: " + username + " @ " + host + ":" + port;
	req.session.userMessageType = "success";

	res.redirect("/");
});

router.get("/disconnect", function(req, res, next) {
	res.cookie('rpc-host', "");
	res.cookie('rpc-port', "");
	res.cookie('rpc-username', "");

	req.session.host = "";
	req.session.port = "";
	req.session.username = "";

	debugLog("destroyed rpc client.");

	global.rpcClient = null;

	req.session.userMessage = "Disconnected from node.";
	req.session.userMessageType = "success";

	res.redirect("/");
});








module.exports = router;

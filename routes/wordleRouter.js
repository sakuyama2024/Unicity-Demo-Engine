"use strict";

const debug = require("debug");
const debugLog = debug("btcexp:router");

const express = require('express');
const router = express.Router();
const asyncHandler = require("express-async-handler");
const utils = require('./../app/utils.js');
const coreApi = require("./../app/api/coreApi.js");

router.get("/spgame", asyncHandler(async (req, res, next) => {
	try {
		const { perfId, perfResults } = utils.perfLogNewItem({action:"spgame"});
		res.locals.perfId = perfId;

		const promises = [];

		promises.push(utils.timePromise("spgame.getBlockchainInfo", async () => {
			res.locals.getblockchaininfo = await coreApi.getBlockchainInfo();
		}, perfResults));

		promises.push(utils.timePromise("spgame.getDeploymentInfo", async () => {
			res.locals.getdeploymentinfo = await coreApi.getDeploymentInfo();
		}, perfResults));

		promises.push(utils.timePromise("spgame.getNetworkInfo", async () => {
			res.locals.getnetworkinfo = await coreApi.getNetworkInfo();
		}, perfResults));

		promises.push(utils.timePromise("spgame.getUptimeSeconds", async () => {
			res.locals.uptimeSeconds = await coreApi.getUptimeSeconds();
		}, perfResults));

		promises.push(utils.timePromise("spgame.getNetTotals", async () => {
			res.locals.getnettotals = await coreApi.getNetTotals();
		}, perfResults));


		await utils.awaitPromises(promises);
		res.locals.perfResults = perfResults;

		await utils.timePromise("spgame.render", async () => {
			res.render("spgame");
		}, perfResults);
		
		next();

	} catch (err) {
		utils.logError("3xx23478efegdde", err);
					
		res.locals.userMessage = "Error building page: " + err;

		await utils.timePromise("spgame.render", async () => {
			res.render("spgame");
		});
	}
}));


router.get("/speedwordlecontest", asyncHandler(async (req, res) => {
	try {
		const { perfId, perfResults } = utils.perfLogNewItem({action:"speedwordlecontest"});
		res.locals.perfId = perfId;

		const promises = [];

		promises.push(utils.timePromise("speedwordlecontest.getBlockchainInfo", async () => {
			res.locals.getblockchaininfo = await coreApi.getBlockchainInfo();
		}, perfResults));

		await utils.awaitPromises(promises);
		res.locals.perfResults = perfResults;

		await utils.timePromise("speedwordlecontest.render", async () => {
			res.render("speedwordlecontest");
		}, perfResults);
		

	} catch (err) {
		utils.logError("7ww23478efegdde", err);
					
		res.locals.userMessage = "Error building page: " + err;

		await utils.timePromise("speedwordlecontest.render", async () => {
			res.render("speedwordlecontest");
		});
	}
}));

module.exports = router;

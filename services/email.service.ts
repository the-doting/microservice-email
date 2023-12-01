import { ServiceSchema } from "../../../lib/types";

import _ from "lodash";
import nodemailer from "nodemailer";
import mustache from "mustache";

const Service: ServiceSchema = {
	name: "email",
	version: "api.v1",

	/**
	 * Service settings
	 */
	settings: {},

	/**
	 * Service dependencies
	 */
	// dependencies: [],

	/**
	 * Actions
	 */
	actions: {
		send: {
			rest: "POST /send",
			params: {
				receptor: {
					type: "email",
				},
				params: {
					type: "object",
					default: {},
					optional: true,
				},
				template: {
					type: "string",
				},
			},
			async handler(ctx) {
				try {
					const { receptor, params, template } = ctx.params;
					const creator = ctx.meta.creator;

					// generate keys for configs
					let keys = ["EMAIL_CONFIG", `EMAIL_CONFIG_TEMPLATE_${template}`];
					// get configs from config service
					const configsResponse: any = await ctx.call(
						"api.v1.config.multiplex",
						{ keys }
					);

					// check if configs are valid
					if (configsResponse.code != 200) {
						return configsResponse;
					}

					// override configs
					let configs: any = {};

					for (let key of keys) {
						const config = configsResponse.data[key];

						if (config.exists == false) {
							return {
								code: 400,
								i18n: "CONFIG_NOT_FOUND",
								data: {
									key: config.key,
								},
							};
						}

						if (config.value && typeof config.value == "object") {
							configs = {
								...configs,
								...config.value,
							};
						}
					}

					let requiredKeyInConfigs = [
						"smtp_host",
						"smtp_port",
						"smtp_secure",
						"smtp_user",
						"smtp_pass",
						"smtp_from",
                        "smtp_name",
						"template",
						"subject",
					];

					// check if configs are valid with lodash
					for (let key of requiredKeyInConfigs) {
						if (!_.has(configs, key)) {
							return {
								code: 400,
								i18n: "NEED_KEY_IN_CONFIGS",
								data: {
									key: key,
								},
							};
						}
					}

					// create transporter
					const transporter = nodemailer.createTransport({
						name: configs.smtp_name,
						host: configs.smtp_host,
						port: configs.smtp_port,
						secure: configs.smtp_secure,
						auth: {
							user: configs.smtp_user,
							pass: configs.smtp_pass,
						},
					});

					// use mustache to render template
					const renderedTemplate = mustache.render(configs.template, params);

					let info = undefined;
					try {
						// send email
						info = await transporter.sendMail({
							from: {
                                name: configs.smtp_name,
                                address: configs.smtp_from,
                            },
							to: receptor,
							subject: configs.subject,
							html: renderedTemplate,
						});
					} catch (error) {
						info = error;
					}

					const status: boolean =
						info && info.accepted && info.accepted.length > 0;

					return {
						code: status ? 200 : 400,
						i18n: status ? "EMAIL_SENT" : "EMAIL_NOT_SENT",
						data: {
							input: {
                                from: configs.smtp_from,
								to: receptor,
								subject: configs.subject,
								html: renderedTemplate,
								smtp: {
                                    name: configs.smtp_name,
									host: configs.smtp_host,
									port: configs.smtp_port,
									secure: configs.smtp_secure,
									auth: {
										user: configs.smtp_user,
										pass: configs.smtp_pass,
									},
								},
							},
							output: info,
						},
					};
				} catch (error) {
					console.error(error);

					return {
						code: 500,
					};
				}
			},
		},
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {},

	/**
	 * Service created lifecycle event handler
	 */
	// created() {},

	/**
	 * Service started lifecycle event handler
	 */
	// started() { },

	/**
	 * Service stopped lifecycle event handler
	 */
	// stopped() { }
};

export = Service;

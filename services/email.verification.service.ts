import { ServiceSchema } from "../../../lib/types";

import _ from "lodash";
import jwt from "jsonwebtoken";

const Service: ServiceSchema = {
	name: "email.verification",
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
		request: {
			rest: "POST /request",
			params: {
				email: {
					type: "email",
				},
			},
			async handler(ctx) {
				try {
					const { email } = ctx.params;
					const creator = ctx.meta.creator.trim().toLowerCase();

					// get user by email
					const resultUserByEmail = await this.getUserByEmail(ctx, email);

					// if user not found
					if (resultUserByEmail.code != 200) {
						return {
							code: 400,
							i18n: "USER_NOT_FOUND",
							data: {
								email,
							},
						};
					}

					// check user email is not verified
					if (resultUserByEmail.data.emailVerified) {
						return {
							code: 400,
							i18n: "EMAIL_ALREADY_VERIFIED",
							data: {
								email,
							},
						};
					}

					// get EMAIL_VERIFICATION_CONFIG from config
					const configResponse: any = await ctx.call("api.v1.config.get", {
						key: "EMAIL_VERIFICATION_CONFIG",
					});

					// check if config is valid
					if (configResponse.code != 200) {
						return configResponse;
					}

					const configs = configResponse.data.value;

					const requiredKeyInConfigs = [
						"email_verification_template",
						"email_jwt_secret",
						"email_jwt_expiresIn",
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

					const validExpiresIn = ["1h", "2h", "3h", "6h", "12h", "1d"];

					// check if expiresIn is valid
					if (!validExpiresIn.includes(configs.email_jwt_expiresIn)) {
						return {
							code: 400,
							i18n: "NEED_VALID_EXPIRES_IN",
							data: {
								valid: validExpiresIn,
								value: configs.email_jwt_expiresIn,
							},
						};
					}

					const payload = {
						user: resultUserByEmail.data.id,
						creator: creator,
					};

					const token = jwt.sign(payload, configs.email_jwt_secret, {
						expiresIn: configs.email_jwt_expiresIn,
					});

					const template = configs.email_verification_template;

					const emailResponse: any = await ctx.call("api.v1.email.send", {
						receptor: email,
						template: template,
						params: {
							token,
							firstname: resultUserByEmail.data.firstname,
							lastname: resultUserByEmail.data.lastname,
							fullname: resultUserByEmail.data.fullname,
							email: resultUserByEmail.data.email,
						},
					});

					if (emailResponse.code != 200) {
						return emailResponse;
					}

					return {
						code: 200,
						i18n: "VERIFICATION_SEND",
					};
				} catch (error) {
					return {
						code: 500,
					};
				}
			},
		},
		verify: {
			rest: "POST /verify",
			params: {
				token: {
					type: "string",
				},
			},
			async handler(ctx) {
				try {
					const { token } = ctx.params;
					const creator = ctx.meta.creator.trim().toLowerCase();

					// get EMAIL_VERIFICATION_CONFIG from config
					const configResponse: any = await ctx.call("api.v1.config.get", {
						key: "EMAIL_VERIFICATION_CONFIG",
					});

					// check if config is valid
					if (configResponse.code != 200) {
						return configResponse;
					}

					const configs = configResponse.data.value;

					const requiredKeyInConfigs = ["email_jwt_secret"];

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

					let decoded: any;

					try {
						decoded = jwt.verify(token, configs.email_jwt_secret);
					} catch (error) {
						return {
							code: 400,
							i18n: "INVALID_TOKEN",
						};
					}

					// check creator is same
					if (decoded.creator != creator) {
						return {
							code: 400,
							i18n: "BAD_CREATOR",
						};
					}

					const resultUserById: any = await ctx.call("api.v1.user.getById", {
						id: decoded.user,
					});

					if (resultUserById.code != 200) {
						return resultUserById;
					}

					const user = resultUserById.data;

					if (user.emailVerified) {
						return {
							code: 400,
							i18n: "EMAIL_ALREADY_VERIFIED",
						};
					}

					const resultUpdateUser: any = await ctx.call("api.v1.user.update", {
						id: user.id,
						emailVerified: true,
					});

					if (resultUpdateUser.code != 200) {
						return resultUpdateUser;
					}

					return {
						code: 200,
						i18n: "EMAIL_VERIFIED",
					};
				} catch (error) {
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
	methods: {
		async getUserByEmail(ctx, email: string) {
			return ctx.call("api.v1.user.getByUnique", {
				unique: "email",
				value: email,
			});
		},
	},

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

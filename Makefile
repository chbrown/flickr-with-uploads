TESTS = test/*.js
REPORTER = dot

-include .env

test:
		@FLICKR_OA_TOKEN=${FLICKR_OA_TOKEN} \
		FLICKR_OA_TOKEN_SECRET=${FLICKR_OA_TOKEN_SECRET} \
		FLICKR_API_KEY=${FLICKR_API_KEY} \
		FLICKR_API_SECRET=${FLICKR_API_SECRET} \
		./node_modules/.bin/mocha \
			--require should \
			--reporter $(REPORTER) \
			--growl \
			$(TESTS)
			
.PHONY: test bench

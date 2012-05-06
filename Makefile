TESTS = test/*.js
REPORTER = dot

test:
		@./node_modules/.bin/mocha \
			--require should \
			--reporter $(REPORTER) \
			--growl \
			$(TESTS)
			
.PHONY: test bench

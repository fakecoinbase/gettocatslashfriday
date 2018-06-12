const util = require("util");

function createAppError(settings) {
    return (new AppError(settings, createAppError));
}

function AppError(settings, implementationContext) {

    // Ensure that settings exists to prevent refernce errors.
    settings = (settings || {});

    // Override the default name property (Error). This is basically zero value-add.
    this.name = "AppError";
    this.type = (settings.type || "Application");
    this.message = (settings.message || "An error occurred.");
    this.detail = (settings.detail || "");
    this.code = (settings.code || "");
    this.isAppError = true;

    // Capture the current stacktrace and store it in the property "this.stack". By
    // providing the implementationContext argument, we will remove the current
    // constructor (or the optional factory function) line-item from the stacktrace; this
    // is good because it will reduce the implementation noise in the stack property.
    // --
    // Rad More: https://code.google.com/p/v8-wiki/wiki/JavaScriptStackTraceApi#Stack_trace_collection_for_custom_exceptions
    Error.captureStackTrace(this, (implementationContext || AppError));

}

util.inherits(AppError, Error);


exports.AppError = AppError;
exports.createAppError = createAppError;
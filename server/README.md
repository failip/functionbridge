# FunctionBridge Worker Server

This serves the FunctionBridge worker script at
`https://functionbridge.com/worker`. You can also serve it yourself from a
different origin if you prefer. Make sure to follow all [security](SECURITY.md)
best practices when hosting the worker, it requires very permissive sandboxing
and should be served with strict Content Security Policies.

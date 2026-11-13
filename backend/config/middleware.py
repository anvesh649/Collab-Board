import re
import time
import uuid

import structlog


def _get_request_id(raw):
    _REQUEST_ID_RE = re.compile(r"[A-Za-z0-9-]{1,128}")
    if raw and _REQUEST_ID_RE.fullmatch(raw):
        return raw
    return str(uuid.uuid4())


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        structlog.contextvars.clear_contextvars()

        request_id = _get_request_id(request.headers.get("X-Request-ID"))

        structlog.contextvars.bind_contextvars(request_id=request_id)

        try:
            response = self.get_response(request)
            response["X-Request-ID"] = request_id
            return response

        finally:
            structlog.contextvars.clear_contextvars()


class CanonicalLogLineMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()
        response = None
        try:
            response = self.get_response(request)
            return response
        finally:
            log = structlog.get_logger(__name__)
            status_code = response.status_code if response is not None else 500
            perf_counter_ms = round((time.perf_counter() - start) * 1000, 2)

            user = getattr(request, "user", None)
            user_id = str(user.pk) if user is not None and user.is_authenticated else None

            match = request.resolver_match
            route = match.route if match else None

            log.info(
                "http_request",
                method=request.method,
                route=route,
                status=status_code,
                duration_ms=perf_counter_ms,
                user_id=user_id,
            )

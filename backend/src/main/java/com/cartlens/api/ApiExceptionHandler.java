package com.cartlens.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.cartlens.api.dto.ApiResponses.ErrorResponse;
import com.cartlens.api.dto.ApiResponses.FieldErrorResponse;
import com.cartlens.application.ApplicationException;
import com.cartlens.application.ErrorCode;

@RestControllerAdvice
public class ApiExceptionHandler {
	@ExceptionHandler(ApplicationException.class)
	public ResponseEntity<ErrorResponse> application(ApplicationException error) {
		return ResponseEntity.status(status(error.code()))
				.body(new ErrorResponse(error.code().name(), error.getMessage(), List.of()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException error) {
		var fields = error.getBindingResult().getFieldErrors().stream()
				.map(field -> new FieldErrorResponse(field.getField(), field.getDefaultMessage())).toList();
		return ResponseEntity.badRequest().body(new ErrorResponse(ErrorCode.VALIDATION_ERROR.name(),
				"Dữ liệu đầu vào không hợp lệ.", fields));
	}

	@ExceptionHandler({ IllegalArgumentException.class, HttpMessageNotReadableException.class })
	public ResponseEntity<ErrorResponse> invalidInput(Exception error) {
		return ResponseEntity.badRequest().body(new ErrorResponse(ErrorCode.VALIDATION_ERROR.name(),
				error instanceof IllegalArgumentException ? error.getMessage() : "Dữ liệu đầu vào không hợp lệ.", List.of()));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> unexpected(Exception error) {
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
				.body(new ErrorResponse(ErrorCode.MINING_FAILED.name(), "Không thể hoàn thành yêu cầu.", List.of()));
	}

	private HttpStatus status(ErrorCode code) {
		return switch (code) {
			case STREAM_NOT_FOUND, RESULT_NOT_FOUND -> HttpStatus.NOT_FOUND;
			case DUPLICATE_TRANSACTION_ID, STREAM_BUSY -> HttpStatus.CONFLICT;
			case VALIDATION_ERROR, WINDOW_NOT_READY, COMPARISON_MISMATCH -> HttpStatus.BAD_REQUEST;
			case MINING_FAILED -> HttpStatus.INTERNAL_SERVER_ERROR;
		};
	}
}

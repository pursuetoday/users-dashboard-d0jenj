import { Request, Response } from 'express'; // ^4.18.2
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  UseInterceptors,
  HttpStatus,
  Req,
  Res,
  HttpCode
} from '@nestjs/common'; // ^10.0.0
import { SecurityHeadersInterceptor } from '@nestjs/security'; // ^1.0.0
import { RateLimiterGuard } from '@nestjs/throttler'; // ^5.0.0

import { AuthService } from '../services/auth.service';
import { ILoginCredentials, IRefreshTokenPayload, IPasswordReset } from '../interfaces/auth.interface';
import { IUserCreate } from '../interfaces/user.interface';
import { createErrorResponse } from '../utils/error.util';
import { ValidationGuard } from '../guards/validation.guard';
import { HTTP_STATUS } from '../constants/http-status';
import { AUTH_ERRORS } from '../constants/error-messages';

/**
 * Enhanced controller class handling authentication HTTP endpoints with security features
 * Implements JWT-based secure authentication with role-based access control,
 * Redis-based token management, and comprehensive rate limiting
 */
@Controller('auth')
@UseInterceptors(SecurityHeadersInterceptor)
export class AuthController {
  /**
   * Initializes AuthController with required dependencies
   * @param authService Service handling authentication logic with Redis integration
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Enhanced login endpoint with rate limiting and security features
   * 
   * @param req Express request object
   * @param res Express response object
   * @param loginDto Login credentials from request body
   * @returns HTTP response with auth tokens and security headers
   */
  @Post('login')
  @UseGuards(ValidationGuard, RateLimiterGuard)
  async login(
    @Req() req: Request, 
    @Res() res: Response, 
    @Body() loginDto: ILoginCredentials
  ): Promise<Response> {
    try {
      // Check rate limiting quota handled by RateLimiterGuard
      
      // Call authService.login with credentials
      const tokens = await this.authService.login(loginDto);
      
      // Set secure HTTP-only cookie for refresh token
      this.setRefreshTokenCookie(res, tokens.refreshToken);
      
      // Store tokens in Redis cache handled by AuthService
      
      // Return tokens with security headers
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer'
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error);
      return res.status(errorResponse.status).json(errorResponse);
    }
  }

  /**
   * Enhanced registration endpoint with advanced validation
   * 
   * @param req Express request object
   * @param res Express response object
   * @param registerDto Registration data from request body
   * @returns HTTP response with auth tokens and security headers
   */
  @Post('register')
  @UseGuards(ValidationGuard, RateLimiterGuard)
  async register(
    @Req() req: Request, 
    @Res() res: Response, 
    @Body() registerDto: IUserCreate
  ): Promise<Response> {
    try {
      // Validate registration data
      if (!registerDto.email || !registerDto.password || 
          !registerDto.firstName || !registerDto.lastName) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Missing required registration fields'
        });
      }
      
      // Check for existing email handled by AuthService
      
      // Validate password strength handled by ValidationGuard
      
      // Call authService.register
      const tokens = await this.authService.register(registerDto);
      
      // Generate secure tokens and store tokens in Redis handled by AuthService
      
      // Set secure HTTP-only cookie for refresh token
      this.setRefreshTokenCookie(res, tokens.refreshToken);
      
      // Return response with security headers
      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer'
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error);
      return res.status(errorResponse.status).json(errorResponse);
    }
  }

  /**
   * Token refresh endpoint with enhanced security
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns HTTP response with fresh auth tokens
   */
  @Post('refresh-token')
  @UseGuards(RateLimiterGuard)
  async refreshToken(
    @Req() req: Request, 
    @Res() res: Response,
    @Body() body: IRefreshTokenPayload
  ): Promise<Response> {
    try {
      // Get refresh token from request body or cookie
      const refreshToken = body.refreshToken || req.cookies?.refreshToken;
      
      // Validate refresh token
      if (!refreshToken) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: AUTH_ERRORS.TOKEN_MISSING
        });
      }
      
      // Call authService to refresh tokens with rotation and blacklisting
      const tokens = await this.authService.refreshToken(refreshToken);
      
      // Set new refresh token cookie
      this.setRefreshTokenCookie(res, tokens.refreshToken);
      
      // Return new access token
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer'
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error);
      return res.status(errorResponse.status).json(errorResponse);
    }
  }

  /**
   * Secure logout with token blacklisting
   * 
   * @param req Express request object
   * @param res Express response object
   * @returns HTTP response confirming logout
   */
  @Post('logout')
  @HttpCode(HTTP_STATUS.OK)
  async logout(
    @Req() req: Request, 
    @Res() res: Response
  ): Promise<Response> {
    try {
      // Get refresh token from cookie
      const refreshToken = req.cookies?.refreshToken;
      
      // Get access token from Authorization header
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;
      
      // Call authService to invalidate tokens
      if (refreshToken || accessToken) {
        await this.authService.logout(refreshToken, accessToken);
      }
      
      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/api/auth/refresh-token',
        sameSite: 'strict'
      });
      
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      // For logout, we want to still proceed with partial operations
      console.error('Error during logout process:', error);
      
      // Clear cookie anyway to ensure client-side logout
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/api/auth/refresh-token',
        sameSite: 'strict'
      });
      
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logged out successfully'
      });
    }
  }

  /**
   * Password reset endpoint with enhanced security
   * 
   * @param req Express request object
   * @param res Express response object
   * @param resetDto Password reset data from request body
   * @returns HTTP response confirming password reset
   */
  @Post('reset-password')
  @UseGuards(ValidationGuard, RateLimiterGuard)
  async resetPassword(
    @Req() req: Request, 
    @Res() res: Response, 
    @Body() resetDto: IPasswordReset
  ): Promise<Response> {
    try {
      // Validate reset token data
      if (!resetDto.email || !resetDto.token || !resetDto.newPassword) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Missing required reset password fields'
        });
      }
      
      // Call authService to reset password
      await this.authService.resetPassword(resetDto);
      
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Password reset successful'
      });
    } catch (error) {
      const errorResponse = createErrorResponse(error);
      return res.status(errorResponse.status).json(errorResponse);
    }
  }

  /**
   * Helper method to set a secure HTTP-only cookie for refresh token
   * Implements enhanced security for token storage in browser
   * 
   * @param res Express response object
   * @param token Refresh token to set in cookie
   * @private
   */
  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true, // Prevents JavaScript access to cookie
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'strict', // Prevents CSRF attacks
      path: '/api/auth/refresh-token' // Restricts cookie to refresh endpoint
    });
  }
}
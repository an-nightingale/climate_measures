<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AdminRedirect
{
    public function handle(Request $request, Closure $next)
    {
        // Если администратор пытается попасть в обычный интерфейс
        if (Auth::check() && Auth::user()->role === 'admin' &&
            $request->route()->getName() === 'climate.index') {
            return redirect()->route('admin.climate');
        }

        return $next($request);
    }
}

# backend/core/physics_solver.py

import numpy as np
from typing import Tuple

class PhysicsSolver:
    """
    Solves hydrodynamics using Shallow Water Equations (SWE).
    
    Implements momentum conservation with advection, pressure gradient, and diffusion:
    ∂u/∂t + u·∂u/∂x + v·∂u/∂y = -g·∂η/∂x + ν·∇²u
    ∂v/∂t + u·∂v/∂x + v·∂v/∂y = -g·∂η/∂y + ν·∇²v
    ∂η/∂t + ∂(hu)/∂x + ∂(hv)/∂y = 0
    
    Uses staggered Arakawa C-grid for numerical stability.
    """
    def __init__(self, grid_shape=(100, 100), domain_size=(200.0, 200.0)):
        """
        Initialize physics solver with Shallow Water Equations.
        
        Args:
            grid_shape: (nx, ny) grid resolution
            domain_size: (Lx, Ly) physical domain size in meters
        """
        self.nx, self.ny = grid_shape
        self.Lx, self.Ly = domain_size
        self.dx = self.Lx / self.nx
        self.dy = self.Ly / self.ny
        
        # Physical constants
        self.g = 9.81  # Gravity (m/s²)
        self.nu = 0.01  # Kinematic viscosity (m²/s) - eddy viscosity for turbulence
        self.h0 = 10.0  # Mean water depth (m)
        
        # State variables (staggered C-grid)
        self.u = np.zeros((self.nx + 1, self.ny))  # u-velocity (m/s) at x-faces
        self.v = np.zeros((self.nx, self.ny + 1))  # v-velocity (m/s) at y-faces
        self.eta = np.zeros((self.nx, self.ny))    # Surface elevation (m) at cell centers
        self.h = np.full((self.nx, self.ny), self.h0)  # Total depth (m)
        
        # Tracer for pollutant visualization (not yet used, prepared for Phase 1B)
        self.tracer = np.zeros((self.nx, self.ny))
        
        # CFL safety factor
        self.cfl_factor = 0.5
        
        print(f"Physics Engine Initialized: SWE solver on {self.nx}x{self.ny} grid")
        print(f"Domain: {self.Lx}m x {self.Ly}m, Resolution: {self.dx:.2f}m")

    def compute_cfl_timestep(self) -> float:
        """
        Compute maximum stable timestep based on CFL condition.
        
        Returns:
            Maximum safe timestep (s)
        """
        # Wave speed: c = sqrt(g*h)
        c_max = np.sqrt(self.g * np.max(self.h))
        
        # Maximum flow speed
        u_max = np.max(np.abs(self.u)) if np.any(self.u) else 0.1
        v_max = np.max(np.abs(self.v)) if np.any(self.v) else 0.1
        
        # CFL condition: dt < dx / (|u| + c)
        dt_max_x = self.dx / (u_max + c_max + 1e-10)
        dt_max_y = self.dy / (v_max + c_max + 1e-10)
        
        return self.cfl_factor * min(dt_max_x, dt_max_y)

    def update(self, delta_time):
        """
        Advance simulation by one timestep using operator splitting:
        1. Advection (upwind scheme)
        2. Pressure gradient (gravity wave propagation)
        3. Diffusion (viscosity)
        """
        # Adaptive timestepping for stability
        dt_max = self.compute_cfl_timestep()
        if delta_time > dt_max:
            # Sub-cycle if requested timestep is too large
            n_substeps = int(np.ceil(delta_time / dt_max))
            dt = delta_time / n_substeps
        else:
            n_substeps = 1
            dt = delta_time
        
        for _ in range(n_substeps):
            self._step_swe(dt)
        
        # Update total depth
        self.h = self.h0 + self.eta
        
        # Clamp velocities to physical bounds
        self.u = np.clip(self.u, -5.0, 5.0)  # Max 5 m/s
        self.v = np.clip(self.v, -5.0, 5.0)

    def _step_swe(self, dt: float):
        """
        Single timestep of Shallow Water Equations using finite differences.
        """
        # --- 1. Advection (upwind scheme for stability) ---
        u_old = self.u.copy()
        v_old = self.v.copy()
        eta_old = self.eta.copy()
        
        # Advect u-momentum
        u_center = 0.5 * (self.u[:-1, :] + self.u[1:, :])  # Interpolate to cell centers
        v_at_u = self._interpolate_v_to_u()
        
        du_dx = np.where(u_center > 0,
                        (self.u[1:-1, :] - self.u[:-2, :]) / self.dx,
                        (self.u[2:, :] - self.u[1:-1, :]) / self.dx)
        du_dy = (self.u[1:-1, 1:] - self.u[1:-1, :-1]) / self.dy
        
        u_advection = -(u_center * du_dx + v_at_u * du_dy)
        
        # Advect v-momentum (similar approach)
        v_center = 0.5 * (self.v[:, :-1] + self.v[:, 1:])
        u_at_v = self._interpolate_u_to_v()
        
        dv_dx = (self.v[1:, 1:-1] - self.v[:-1, 1:-1]) / self.dx
        dv_dy = np.where(v_center > 0,
                        (self.v[:, 1:-1] - self.v[:, :-2]) / self.dy,
                        (self.v[:, 2:] - self.v[:, 1:-1]) / self.dy)
        
        v_advection = -(u_at_v * dv_dx + v_center * dv_dy)
        
        # --- 2. Pressure gradient force (gravity waves) ---
        # ∂η/∂x and ∂η/∂y drive flow
        deta_dx = (eta_old[1:, :] - eta_old[:-1, :]) / self.dx
        deta_dy = (eta_old[:, 1:] - eta_old[:, :-1]) / self.dy
        
        pressure_u = -self.g * deta_dx
        pressure_v = -self.g * deta_dy
        
        # --- 3. Diffusion (viscosity) ---
        diffusion_u = self._compute_diffusion(u_old[1:-1, :], self.dx, self.dy)
        diffusion_v = self._compute_diffusion(v_old[:, 1:-1], self.dx, self.dy)
        
        # --- Update velocities ---
        self.u[1:-1, :] += dt * (u_advection + pressure_u + self.nu * diffusion_u)
        self.v[:, 1:-1] += dt * (v_advection + pressure_v + self.nu * diffusion_v)
        
        # --- 4. Continuity equation (mass conservation) ---
        # ∂η/∂t = -∂(hu)/∂x - ∂(hv)/∂y
        h_at_u = self.h  # Simplified: use cell-centered depth
        h_at_v = self.h
        
        dhu_dx = (h_at_u[1:, :] * self.u[1:-1, :] - h_at_u[:-1, :] * self.u[:-2, :]) / self.dx
        dhv_dy = (h_at_v[:, 1:] * self.v[:, 1:-1] - h_at_v[:, :-1] * self.v[:, :-2]) / self.dy
        
        # Pad to match eta dimensions
        dhu_dx_padded = np.pad(dhu_dx, ((0, 0), (0, 0)), mode='edge')
        dhv_dy_padded = np.pad(dhv_dy, ((0, 0), (0, 0)), mode='edge')
        
        self.eta -= dt * (dhu_dx_padded + dhv_dy_padded)
        
        # Clamp eta to prevent extreme elevations
        self.eta = np.clip(self.eta, -2.0, 2.0)
        
        # --- Boundary conditions (reflective walls) ---
        self.u[0, :] = 0.0
        self.u[-1, :] = 0.0
        self.v[:, 0] = 0.0
        self.v[:, -1] = 0.0

    def _compute_diffusion(self, field: np.ndarray, dx: float, dy: float) -> np.ndarray:
        """
        Compute Laplacian (∇²field) for diffusion term.
        """
        laplacian_x = (np.roll(field, 1, axis=0) - 2 * field + np.roll(field, -1, axis=0)) / (dx ** 2)
        laplacian_y = (np.roll(field, 1, axis=1) - 2 * field + np.roll(field, -1, axis=1)) / (dy ** 2)
        return laplacian_x + laplacian_y

    def _interpolate_v_to_u(self) -> np.ndarray:
        """
        Interpolate v-velocity from y-faces to u-velocity positions (x-faces).
        """
        # Average 4 surrounding v values to get v at u location
        v_at_u = 0.25 * (self.v[:-1, :-1] + self.v[1:, :-1] + 
                        self.v[:-1, 1:] + self.v[1:, 1:])
        return v_at_u

    def _interpolate_u_to_v(self) -> np.ndarray:
        """
        Interpolate u-velocity from x-faces to v-velocity positions (y-faces).
        """
        u_at_v = 0.25 * (self.u[:-1, :-1] + self.u[:-1, 1:] + 
                        self.u[1:, :-1] + self.u[1:, 1:])
        return u_at_v

    def get_flow_vector(self, x: int, y: int) -> np.ndarray:
        """
        Get velocity vector at cell center (i, j).
        
        Args:
            x, y: Grid indices
            
        Returns:
            [u, v] velocity in m/s
        """
        if 0 <= x < self.nx and 0 <= y < self.ny:
            # Interpolate from staggered grid to cell center
            u_center = 0.5 * (self.u[x, y] + self.u[x + 1, y]) if x < self.nx - 1 else self.u[x, y]
            v_center = 0.5 * (self.v[x, y] + self.v[x, y + 1]) if y < self.ny - 1 else self.v[x, y]
            return np.array([u_center, v_center])
        return np.array([0.0, 0.0])

    def get_velocity_field(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Get full velocity field interpolated to cell centers.
        
        Returns:
            (u_grid, v_grid) each shape (nx, ny)
        """
        u_center = np.zeros((self.nx, self.ny))
        v_center = np.zeros((self.nx, self.ny))
        
        # Interpolate u from faces to centers
        u_center[:-1, :] = 0.5 * (self.u[:-1, :] + self.u[1:, :])
        u_center[-1, :] = self.u[-1, :]
        
        # Interpolate v from faces to centers
        v_center[:, :-1] = 0.5 * (self.v[:, :-1] + self.v[:, 1:])
        v_center[:, -1] = self.v[:, -1]
        
        return u_center, v_center

    def inject_momentum(self, x: int, y: int, radius: int, u_impulse: float, v_impulse: float):
        """
        Inject momentum at a specific location (e.g., simulate a jet or current).
        
        Args:
            x, y: Center grid cell
            radius: Radius of influence (grid cells)
            u_impulse: Velocity impulse in x-direction (m/s)
            v_impulse: Velocity impulse in y-direction (m/s)
        """
        x_min = max(0, x - radius)
        x_max = min(self.nx, x + radius + 1)
        y_min = max(0, y - radius)
        y_max = min(self.ny, y + radius + 1)
        
        # Add impulse to velocity field
        self.u[x_min:x_max+1, y_min:y_max] += u_impulse
        self.v[x_min:x_max, y_min:y_max+1] += v_impulse
        
        print(f"Momentum injected at ({x}, {y}): u={u_impulse:.2f}, v={v_impulse:.2f} m/s")

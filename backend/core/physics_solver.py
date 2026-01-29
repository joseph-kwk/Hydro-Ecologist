# backend/core/physics_solver.py

import numpy as np

class PhysicsSolver:
    """
    Solves the physical movement of water, including hydrodynamics and flow.
    Uses simplified Navier-Stokes or Shallow Water Equations for performance.
    """
    def __init__(self, grid_shape=(100, 100)):
        self.grid = np.zeros(grid_shape + (3,))  # (x, y, [velocity_u, velocity_v, depth])

    def update(self, delta_time):
        """
        Runs one time-step of the fluid dynamics simulation.
        """
        # Placeholder: A simple diffusion model for now
        # In a real scenario, this would solve differential equations
        diffusion_factor = 0.01
        laplacian = -4 * self.grid + np.roll(self.grid, 1, axis=0) + np.roll(self.grid, -1, axis=0) + \
                    np.roll(self.grid, 1, axis=1) + np.roll(self.grid, -1, axis=1)
        
        self.grid += diffusion_factor * laplacian * delta_time
        print("Physics step completed.")

    def get_flow_vector(self, x, y):
        """
        Returns the flow vector at a specific grid point.
        """
        if 0 <= x < self.grid.shape[0] and 0 <= y < self.grid.shape[1]:
            return self.grid[x, y, :2]
        return np.array([0, 0])

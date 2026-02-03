export const formatRut = (rut: string): string => {
  if (!rut) return '';
  
  // 1. Limpiar el RUT (dejar solo números y k)
  const value = rut.replace(/[^0-9kK]/g, '');
  
  // 2. Si es muy corto, devolver tal cual
  if (value.length <= 1) return value;
  
  // 3. Obtener cuerpo y dígito verificador
  const body = value.slice(0, -1);
  const dv = value.slice(-1).toUpperCase();
  
  // 4. Formatear el cuerpo con puntos
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // 5. Retornar con guión
  return `${formattedBody}-${dv}`;
};

export const cleanRut = (rut: string): string => {
  return rut.replace(/[^0-9kK]/g, '');
};
import teldEquipment from "@assets/image_search/teld-equipment.png";
import teldFariaLima from "@assets/image_search/teld-faria-lima.jpg";
import teldBandeirantes from "@assets/image_search/teld-bandeirantes.jpg";
import teldCampoBelo from "@assets/image_search/teld-campo-belo.jpg";

export const companyProductImages = [
  teldEquipment,
  teldFariaLima,
  teldBandeirantes,
  teldCampoBelo,
];

export function getCompanyProductImage(index: number) {
  const normalizedIndex = Math.abs(index) % companyProductImages.length;
  return companyProductImages[normalizedIndex];
}
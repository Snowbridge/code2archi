package com.farzoom.bg.components.bgproduct;

import com.farzoom.bg.config.AppConfig;
import com.farzoom.bg.services.CurrencyMoneyService;
import com.farzoom.common.business.genparam.GenParam;
import com.farzoom.common.business.genparam.GenParamService;
import com.farzoom.common.business.ref.RefItem;
import com.farzoom.common.business.ref.RefService;
import com.farzoom.common.components.ComponentController;
import com.farzoom.common.persistence.es.model.BeneficiaryContacts;
import com.farzoom.common.persistence.es.model.Company;
import com.farzoom.common.persistence.es.model.Order;
import com.farzoom.common.persistence.es.model.Product;
import com.farzoom.common.persistence.es.model.ProductBg;
import com.farzoom.common.persistence.es.repositories.CompanyRepository;
import com.farzoom.common.persistence.es.repositories.OrderRepository;
import com.farzoom.common.persistence.es.repositories.ProductRepository;
import com.farzoom.common.persistence.es.repositories.base.EsRepository;
import com.farzoom.common.utils.DateUtils;
import com.farzoom.common.utils.MoneyUtils;
import com.jcabi.aspects.Loggable;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.lang.StringUtils;
import org.camunda.bpm.engine.delegate.DelegateTask;
import org.camunda.spin.json.SpinJsonNode;
import org.springframework.beans.BeanUtils;
import org.springframework.context.ApplicationContext;
import org.springframework.util.CollectionUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static com.farzoom.bg.pa.InitDelegate.DURATION_MAX_DAYS;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toMap;
import static org.apache.commons.lang.StringUtils.isNotBlank;
import static org.camunda.spin.Spin.JSON;

@Loggable
@Log4j2
public class FzCBgProductEditController implements ComponentController {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CompanyRepository companyRepository;
    private final EsRepository esRepository;
    private final RefService refService;
    private final DelegateTask delegateTask;
    private final AppConfig config;
    private final CurrencyMoneyService currencyMoneyService;
    private final GenParamService genParamService;

    private String name = "order";
    private String orderId;
    private Boolean canEdit = false;
    private String productChangedProcessVarName;
    private String anyChangesInProductVarName;
    private String beneficiaryContactsChangedVarName;
    private String rntChangedByClientVarName;
    private String contractChangedByClientVarName;
    private String lawChangedByClientVarName;
    private String guaranteeTypeChangedByClientVarName;
    private Long productApprovedAmount;
    private Long productAmountMaxChange;
    private Long calcCommissionAmount;
    private boolean isBgCurrency;
    private Boolean isSmp = false;

    public FzCBgProductEditController(ApplicationContext applicationContext, DelegateTask delegateTask) {
        orderRepository = applicationContext.getBean(OrderRepository.class);
        productRepository = applicationContext.getBean(ProductRepository.class);
        companyRepository = applicationContext.getBean(CompanyRepository.class);
        esRepository = applicationContext.getBean(EsRepository.class);
        config = applicationContext.getBean(AppConfig.class);
        refService = applicationContext.getBean(RefService.class);
        currencyMoneyService = applicationContext.getBean(CurrencyMoneyService.class);
        genParamService = applicationContext.getBean(GenParamService.class);
        this.delegateTask = delegateTask;
    }

    public FzCBgProductEditController setName(String name) {
        this.name = name;
        return this;
    }

    @Override
    public String getName() {
        return name;
    }

    public FzCBgProductEditController setOrderId(String orderId) {
        this.orderId = orderId;
        return this;
    }

    public FzCBgProductEditController isBgCurrency(Boolean isBgCurrency) {
        this.isBgCurrency = isBgCurrency;
        return this;
    }

    public FzCBgProductEditController setCanEdit(Boolean canEdit) {
        this.canEdit = canEdit;
        return this;
    }

    public FzCBgProductEditController setProductApprovedAmount(Long productApprovedAmount) {
        this.productApprovedAmount = productApprovedAmount;
        return this;
    }

    public FzCBgProductEditController setProductAmountMaxChange(Long productAmountMaxChange) {
        this.productAmountMaxChange = productAmountMaxChange;
        return this;
    }

    public FzCBgProductEditController setProductChangedProcessVarName(String productChangedProcessVarName) {
        this.productChangedProcessVarName = productChangedProcessVarName;
        return this;
    }

    //переменная, которая = true при любом изменении даты и суммы в продукте
    public FzCBgProductEditController setVarNamedForAnyChangesInProduct(String anyChangesInProductVarName) {
        this.anyChangesInProductVarName = anyChangesInProductVarName;
        return this;
    }

    public FzCBgProductEditController setCalcCommissionAmount(Long calcCommissionAmount) {
        this.calcCommissionAmount = calcCommissionAmount;
        return this;
    }

    public FzCBgProductEditController isSmp(Boolean isSmp) {
        this.isSmp = isSmp;
        return this;
    }

    public FzCBgProductEditController setBeneficiaryContactsChangedVarName(String beneficiaryContactsChangedVarName) {
        this.beneficiaryContactsChangedVarName = beneficiaryContactsChangedVarName;
        return this;
    }

    public FzCBgProductEditController setRntChangedByClientVarName(String rntChangedByClientVarName) {
        this.rntChangedByClientVarName = rntChangedByClientVarName;
        return this;
    }

    public FzCBgProductEditController setContractChangedByClientVarName(String contractChangedByClientVarName) {
        this.contractChangedByClientVarName = contractChangedByClientVarName;
        return this;
    }

    public FzCBgProductEditController setLawChangedByClientVarName(String lawChangedByClientVarName) {
        this.lawChangedByClientVarName = lawChangedByClientVarName;
        return this;
    }

    public FzCBgProductEditController setGuaranteeTypeChangedByClientVarName(String guaranteeTypeChangedByClientVarName) {
        this.guaranteeTypeChangedByClientVarName = guaranteeTypeChangedByClientVarName;
        return this;
    }

    @Override
    public String load() {
        log.info("Load model");

        Order order = orderRepository.load(orderId);
        Product product = productRepository.load(order.getProductId());

        FzCBgProductEditModel viewModel = new FzCBgProductEditModel();
        viewModel.setRef(new HashMap<>());
        viewModel.getRef().put("federalLaw", loadRef("federalLaw"));
        viewModel.getRef().put("bankGuaranteeType", loadRef("bankGuaranteeType"));

        viewModel.setData(new FzCBgProductEditModel.Product());
        viewModel.getData().setBankGuaranteeTypeRefId(product.getBg().getBankGuaranteeTypeRefId());
        viewModel.getData().setCurrencyRefId(product.getCurrencyRefId());

        List<RefItem> bankGuaranteeTypes = refService.getItems("bankGuaranteeType");
        if (!bankGuaranteeTypes.isEmpty()) {
            viewModel.getData().setBankGuaranteeTypeRefName(getRef(bankGuaranteeTypes, product.getBg().getBankGuaranteeTypeRefId()));
        }
        addCurrency(viewModel, orderId);
        viewModel.getData().setStartDate(product.getStartDate());
        viewModel.getData().setEndDate(product.getEndDate());
        viewModel.getData().setPurchase(new FzCBgProductEditModel.Purchase());

        // для предварительного расчета комиссии на UI, если выбран тип доставки swift
        viewModel.getData().setAdditionalCommissionSwift(
                new FzCBgProductEditModel.AdditionalCommissionSwift(
                        calcCommissionAmount,
                        config.getFixSwift1(),
                        config.getFixSwift2()
                )
        );
        viewModel.getData().getPurchase().setPurchaseNumber(product.getBg().getPurchase().getPurchaseNumber());
        viewModel.getData().getPurchase().setPurchaseSubject(product.getBg().getPurchase().getPurchaseSubject());
        viewModel.getData().getPurchase().setLaw(product.getBg().getPurchase().getLaw());

        List<FzCBgProductEditModel.Lot> vmLots = new ArrayList<>();
        for (ProductBg.Lot esLot : product.getBg().getPurchase().getLots()) {
            FzCBgProductEditModel.Lot vmLot = new FzCBgProductEditModel.Lot();
            vmLot.setLotNumber(esLot.getLotNumber());
            vmLot.setLotSubject(esLot.getLotSubject());
            vmLot.setNeedSMP(Optional.ofNullable(esLot.getNeedSMP()).orElse(false));
            vmLot.setNeedBilingual(Optional.ofNullable(esLot.getNeedBilingual()).orElse(false));
            if (esLot.getContractConditions() != null) {
                vmLot.setContractConditions(new FzCBgProductEditModel.ContractConditions());
                vmLot.getContractConditions().setPrepaymentExists(esLot.getContractConditions().getPrepaymentExists());
                vmLot.getContractConditions().setPrepaymentAmount(esLot.getContractConditions().getPrepaymentAmount());
            }
            vmLot.setBeneficiaries(new ArrayList<>());
            for (ProductBg.Beneficiary esBen : esLot.getBeneficiaries()) {
                FzCBgProductEditModel.Beneficiary vmBen = new FzCBgProductEditModel.Beneficiary();
                BeanUtils.copyProperties(esBen, vmBen);

                if (product.getBg().getBankGuaranteeTypeRefId().equalsIgnoreCase("payment") && esBen.getContract() != null) {
                    FzCBgProductEditModel.BeneficiaryContract vmBenContract = new FzCBgProductEditModel.BeneficiaryContract();
                    vmBenContract.setContractNumber(esBen.getContract().getContractNumber());
                    vmBenContract.setContractDate(esBen.getContract().getContractDate());
                    vmBen.setContract(vmBenContract);
                }

                log.info("### vmBen: {}", vmBen);

                if (esBen.getCompanyId() != null) {
                    Company company = companyRepository.load(esBen.getCompanyId());
                    vmBen.setKpp(company.getKPP());
                    vmBen.setFullName(company.getFullName());
                }
                BeneficiaryContacts esBenContacts = esBen.getContacts();
                if (esBenContacts != null) {
                    FzCBgProductEditModel.BeneficiaryContacts vmBenContacts = new FzCBgProductEditModel.BeneficiaryContacts();
                    vmBenContacts.setEmail(esBenContacts.getEmail());
                    vmBenContacts.setPhone(esBenContacts.getPhone());
                    vmBen.setContacts(vmBenContacts);
                }
                FzCBgProductEditModel.BeneficiaryContract vmBenContract = new FzCBgProductEditModel.BeneficiaryContract();
                if (esBen.getContract() != null) {
                    vmBenContract.setContractNumber(esBen.getContract().getContractNumber());
                    vmBenContract.setContractDate(esBen.getContract().getContractDate());
                    vmBen.setContract(vmBenContract);
                }

                vmLot.getBeneficiaries().add(vmBen);
            }

            vmLots.add(vmLot);
        }
        viewModel.getData().getPurchase().setLots(vmLots);
        viewModel.getData().setIsSmp(isSmp);

        log.info("Load model - done");

        return JSON(viewModel).toString();
    }

    private void addCurrency(FzCBgProductEditModel viewModel, String orderId) {

        Long rateValue = currencyMoneyService.getRateMoneyValue(orderId);
        Long nominal = currencyMoneyService.getNominalLongValue(orderId);
        if (nominal == null) {
            //Для обратной совместимости старых процессов
            viewModel.getData().setCurrentRate(rateValue);
        } else {
            BigDecimal rate = MoneyUtils.moneyToRate(rateValue);
            FzCBgProductEditModel.Currency currency = new FzCBgProductEditModel.Currency(String.valueOf(rate), nominal);
            viewModel.getData().setCurrency(currency);
        }
    }

    private String getRef(List<RefItem> refItems, String id) {
        return refItems.stream().filter(i -> i.getValue().equals(id)).findFirst().map(RefItem::getName).orElse(null);
    }

    @Override
    public void store(String json) {
        log.info("Store model");
        if (!canEdit) {
            log.info("Component is readonly");
            return;
        }

        FzCBgProductEditModel viewModel = JSON(json).mapTo(FzCBgProductEditModel.class);

        Date newStartDate = viewModel.getData().getStartDate();
        Date nowDate = Date.from(LocalDate.now().atTime(LocalTime.MAX).atZone(ZoneId.systemDefault()).toInstant());
        if (newStartDate.before(nowDate)) {
            newStartDate = nowDate;
        }

        Date newEndDate = viewModel.getData().getEndDate();
        if (newEndDate.before(newStartDate)) {
            throw new IllegalArgumentException("Дата окончания не может быть меньше даты начала.");
        }

        final long newDaysDuration = DateUtils.getDurationDays(newStartDate, newEndDate);
        if (newDaysDuration > DURATION_MAX_DAYS) {
            throw new IllegalArgumentException("Срок выдачи БГ не должен превышать " + DURATION_MAX_DAYS + " дня");
        }

        String newPurchaseNumber = viewModel.getData().getPurchase().getPurchaseNumber();
        String newPurchaseSubject = viewModel.getData().getPurchase().getPurchaseSubject();
        String newLaw = viewModel.getData().getPurchase().getLaw();
        String newBankGuaranteeRefId = viewModel.getData().getBankGuaranteeTypeRefId();

        log.info("###@@@ viewModel: {}", viewModel);

        long amount = !isBgCurrency ?
                viewModel.getData().getPurchase().getLots().stream()
                        .flatMap(lot -> lot.getBeneficiaries().stream())
                        .mapToLong(FzCBgProductEditModel.Beneficiary::getBgAmount)
                        .sum()
                :
                viewModel.getData().getPurchase().getLots().stream()
                        .flatMap(lot -> lot.getBeneficiaries().stream())
                        .mapToLong(FzCBgProductEditModel.Beneficiary::getBgCurrencyAmount)
                        .sum();

        log.info("###@@@ amount: {}", amount);

        List<FzCBgProductEditModel.Lot> lots = viewModel.getData().getPurchase().getLots();

        Order order = orderRepository.load(orderId);
        Product product = productRepository.load(order.getProductId());

        if (product.getProductTypeRefId().equalsIgnoreCase("payment")) {
            try {
                lots.forEach(lot -> lot.getBeneficiaries()
                        .forEach(beneficiary -> {
                            FzCBgProductEditModel.BeneficiaryContract contract = beneficiary.getContract();
                            if (contract.getContractDate() == null) {
                                throw new RuntimeException("Не установлена дата контракта Платежной гарантии");
                            }

                            if (contract.getContractNumber() == null) {
                                throw new RuntimeException("Не установлен номер контракта Платежной гарантии");
                            }
                        })
                );
            } catch (RuntimeException ex) {
                log.info("### exception message details:{}", ex.getLocalizedMessage());
                throw new RuntimeException("Для платежных гарантий поля дата и номер контракта должны быть заполнены");
            }
        }

        viewModel.getData().getPurchase().setPurchaseNumber(product.getBg().getPurchase().getPurchaseNumber());
        viewModel.getData().getPurchase().setPurchaseSubject(product.getBg().getPurchase().getPurchaseSubject());
        viewModel.getData().getPurchase().setLaw(product.getBg().getPurchase().getLaw());


        log.info("updating product: {}, orderId={}", order.getProductId(), orderId);

        long currentDaysDuration = DateUtils.getDurationDays(product.getStartDate(), product.getEndDate());
        log.info(" durationDays: new - {}, old - {}", newDaysDuration, currentDaysDuration);

        boolean isPurchaseNumberChanged = !newPurchaseNumber.equals(product.getBg().getPurchase().getPurchaseNumber()) &&
                !newPurchaseNumber.equals(getOldPurchaseNumber(product.getId()));
        // срок увеличен или сумма увеличена на значение, превышающее разрешенный порог изменения
        boolean productChanged = newDaysDuration > currentDaysDuration ||
                isProductAmountChangedToProductAmountMaxChange(amount) ||
                !newLaw.equals(product.getBg().getPurchase().getLaw()) ||
                !newBankGuaranteeRefId.equals(product.getBg().getBankGuaranteeTypeRefId()) ||
                isPurchaseNumberChanged;

        boolean anyPurchaseChange = isPurchaseNumberChanged ||
                (newPurchaseSubject != null && !newPurchaseSubject.equals(product.getBg().getPurchase().getPurchaseSubject())) ||
                !newLaw.equals(product.getBg().getPurchase().getLaw());

        // при любом изменении скора или суммы отправляем на пересчет
        boolean anyDurationChange = newDaysDuration != currentDaysDuration;
        boolean anyAmountChange = isProductAmountChanged(amount);
        boolean anyChangesInProduct = anyDurationChange || anyAmountChange || anyPurchaseChange;
        log.info(" duration changed - {}, amount changed - {}, purchase changed - {}", anyDurationChange, anyAmountChange, anyPurchaseChange);

        if (StringUtils.isNotBlank(rntChangedByClientVarName)) {
            log.info("new purchase number = [{}], old purchaseNumber = [{}], is new = [{}]",
                    newPurchaseNumber,
                    product.getBg().getPurchase().getPurchaseNumber(),
                    isPurchaseNumberChanged);
            delegateTask.getExecution().setVariable(rntChangedByClientVarName, isPurchaseNumberChanged);
        }

        if (StringUtils.isNotBlank(lawChangedByClientVarName)) {
            log.info("new law = [{}], old law = [{}], is new = [{}]",
                    newLaw,
                    product.getBg().getPurchase().getLaw(),
                    !newLaw.equals(product.getBg().getPurchase().getLaw()));
            delegateTask.getExecution().setVariable(lawChangedByClientVarName, !newLaw.equals(product.getBg().getPurchase().getLaw()));
        }

        if (StringUtils.isNotBlank(guaranteeTypeChangedByClientVarName)) {
            log.info("new guarantee type = [{}], old guarantee type = [{}], is new = [{}]",
                    newBankGuaranteeRefId,
                    product.getBg().getBankGuaranteeTypeRefId(),
                    !newBankGuaranteeRefId.equals(product.getBg().getBankGuaranteeTypeRefId()));
            delegateTask.getExecution().setVariable(guaranteeTypeChangedByClientVarName, !newBankGuaranteeRefId.equals(product.getBg().getBankGuaranteeTypeRefId()));
        }

        product.setStartDate(newStartDate);
        product.setEndDate(newEndDate);
        product.setDurationDays(Math.toIntExact(newDaysDuration));
        product.getBg().setBankGuaranteeTypeRefId(newBankGuaranteeRefId);

        if (!isBgCurrency) {
            product.setAmount(amount);
        } else {
            // если валютная гарантия, то пересчтиваем по курсу amount
            Long amountInRub = calculateAmountByCurrentRate(amount);
            product.setAmount(amountInRub);
            product.setCurrencyAmount(amount);
        }

        ProductBg.Purchase purchase = product.getBg().getPurchase();
        purchase.setPurchaseSubject(newPurchaseSubject);
        purchase.setPurchaseNumber(newPurchaseNumber);
        purchase.setLaw(newLaw);
        Map<String, ProductBg.Lot> esLots = purchase.getLots().stream()
                .collect(toMap(ProductBg.Lot::getLotNumber, identity()));
        boolean lotsUpdated = false;
        boolean isBeneficiaryContactsChanged = false;
        boolean isBeneficiaryContractChanged = false;


        for (FzCBgProductEditModel.Lot vmLot : viewModel.getData().getPurchase().getLots()) {
            FzCBgProductEditModel.Beneficiary vmBen = vmLot.getBeneficiaries().stream().findFirst().orElse(null);
            if (vmBen != null) {
                checkBeneficiaryContacts(vmBen, vmLot);
            }

            ProductBg.Lot esLot = esLots.get(vmLot.getLotNumber());
            ProductBg.Beneficiary esBen = esLot.getBeneficiaries().stream().findFirst().orElse(null);

            if (!isBeneficiaryContactsChanged && vmBen != null && esBen != null) {
                isBeneficiaryContactsChanged = isBeneficiaryContactsChanged(vmBen, esBen);
            }

            if (!isBeneficiaryContractChanged && vmBen != null && esBen != null) {
                isBeneficiaryContractChanged = isBeneficiaryContractChanged(vmBen, esBen);
            }

            lotsUpdated = updateLot(vmLot, esLot, purchase) || lotsUpdated;
        }

        if (StringUtils.isNotBlank(contractChangedByClientVarName)) {
            log.info("[{}] = [{}]", contractChangedByClientVarName, isBeneficiaryContractChanged);
            delegateTask.getExecution().setVariable(contractChangedByClientVarName, isBeneficiaryContractChanged);
        }

        if (StringUtils.isNotBlank(beneficiaryContactsChangedVarName)) {
            log.info("[{}] = [{}]", beneficiaryContactsChangedVarName, isBeneficiaryContactsChanged);
            delegateTask.getExecution().setVariable(beneficiaryContactsChangedVarName, isBeneficiaryContactsChanged);
        }

        if (StringUtils.isNotBlank(productChangedProcessVarName)) {
            // нужен повторный скоринг?
            boolean productOrLotChanges = productChanged || lotsUpdated || isBeneficiaryContractChanged;
            log.info("{}={}", productChangedProcessVarName, productOrLotChanges);
            delegateTask.getExecution().setVariable(productChangedProcessVarName, productOrLotChanges);
        }

        if (StringUtils.isNotBlank(anyChangesInProductVarName)) {
            // нужен пересчет комиссии?
            boolean anyProductOrLotChanges = anyChangesInProduct || lotsUpdated;
            log.info("{}={}", anyChangesInProductVarName, anyProductOrLotChanges);
            delegateTask.getExecution().setVariable(anyChangesInProductVarName, anyProductOrLotChanges);
        }

        log.info("productChanged: {}, lotsUpdated: {}", productChanged, lotsUpdated);
        productRepository.replace(order.getProductId(), product);
        log.info("Store model - done");
    }

    private boolean isProductAmountChanged(final Long newAmount) {
        return productApprovedAmount == null || newAmount.compareTo(productApprovedAmount) != 0;
    }

    private boolean isProductAmountChangedToProductAmountMaxChange(final Long newAmount) {
        return productApprovedAmount == null || newAmount.compareTo(productAmountMaxChange + productApprovedAmount) > 0;
    }

    private boolean updateLot(FzCBgProductEditModel.Lot vmLot, ProductBg.Lot esLot, ProductBg.Purchase purchase) {
        if (vmLot == null || esLot == null) {
            return false;
        }

        boolean lotUpdated = false;

        String lotSubject = vmLot.getLotSubject();
        if (lotSubject != null) {
            if (!lotSubject.equals(esLot.getLotSubject())) {
                log.info("  lot subject changed: new - '{}', old - '{}'", lotSubject, esLot.getLotSubject());
                esLot.setLotSubject(lotSubject);
                if (purchase.getLots().size() == 1) {
                    // BG-1308 для однолотов нужно обновить purchase.purchaseSubject для карточки заявки в ЛК,
                    // если был изменен purchase.lots[0].lotSubject
                    purchase.setPurchaseSubject(lotSubject);
                }
            }
        }

        Boolean needSMP = vmLot.getNeedSMP();
        if (needSMP != null && !needSMP.equals(esLot.getNeedSMP())) {
            log.info("needSMP changed: new - '{}', old - '{}'", needSMP, esLot.getNeedSMP());
            esLot.setNeedSMP(needSMP);
        }

        Boolean needBilingual = vmLot.getNeedBilingual();
        if (needBilingual != null && !needBilingual.equals(esLot.getNeedBilingual())) {
            log.info("needBilingual changed: new - '{}', old - '{}'", needBilingual, esLot.getNeedBilingual());
            esLot.setNeedBilingual(needBilingual);
        }

        if (vmLot.getContractConditions() != null) {
            if (esLot.getContractConditions() == null) {
                log.info("  contract conditions is null in es model");
                esLot.setContractConditions(new ProductBg.ContractConditions());
            }

            Boolean vmPrepaymentExists = vmLot.getContractConditions().getPrepaymentExists();
            Boolean esPrepaymentExists = esLot.getContractConditions().getPrepaymentExists();
            if (!Objects.equals(vmPrepaymentExists, esPrepaymentExists)) {
                log.info("  prepayment exists changed: new - {}, old - {}", vmPrepaymentExists, esPrepaymentExists);
                esLot.getContractConditions().setPrepaymentExists(vmPrepaymentExists);
                lotUpdated = true;
            }
            // если флаг аванса - false, то удаляем сумму аванса
            Long esPrepaymentAmount = esLot.getContractConditions().getPrepaymentAmount();
            Long vmPrepaymentAmount = Boolean.FALSE.equals(vmPrepaymentExists) ? null : vmLot.getContractConditions().getPrepaymentAmount();
            if (!Objects.equals(vmPrepaymentAmount, esPrepaymentAmount)) {
                log.info("  prepayment amount changed: new - {}, old - {}", vmPrepaymentAmount, esPrepaymentAmount);
                esLot.getContractConditions().setPrepaymentAmount(vmPrepaymentAmount);
                if (vmPrepaymentAmount != null) {
                    lotUpdated = true;
                }
            }
        }

        if (!CollectionUtils.isEmpty(esLot.getBeneficiaries()) && !CollectionUtils.isEmpty(vmLot.getBeneficiaries())) {
            ProductBg.Beneficiary esBen = esLot.getBeneficiaries().get(0);
            FzCBgProductEditModel.Beneficiary vmBen = vmLot.getBeneficiaries().get(0);
            lotUpdated = updateBeneficiary(vmBen, esBen) || lotUpdated;
        } else {
            log.warn("  no beneficiaries found for update");
        }

        log.info("lot {} updated: {}", esLot.getLotNumber(), lotUpdated);
        return lotUpdated;
    }

    private boolean updateBeneficiary(FzCBgProductEditModel.Beneficiary vmBen, ProductBg.Beneficiary esBen) {
        boolean beneficiaryUpdated = false;

        log.info("### vmBen: {} esBen: {}", vmBen, esBen);

        if (!isBgCurrency) {
            Long bgAmount = vmBen.getBgAmount();
            if (bgAmount != null) {
                if (!bgAmount.equals(esBen.getBgAmount())) {
                    log.info("  ben amount changed: new - {}, old - {}", bgAmount, esBen.getBgAmount());
                    esBen.setBgAmount(bgAmount);
                }
            }
        } else {
            Long bgCurrencyAmount = vmBen.getBgCurrencyAmount();
            if (bgCurrencyAmount != null) {
                if (!bgCurrencyAmount.equals(esBen.getBgCurrencyAmount())) {
                    esBen.setBgCurrencyAmount(bgCurrencyAmount);
                    log.info("  ben bgCurrencyAmount changed: new - {}, old - {}", bgCurrencyAmount, esBen.getBgCurrencyAmount());
                    esBen.setBgCurrencyAmount(bgCurrencyAmount);
                    Long amountInRub = calculateAmountByCurrentRate(bgCurrencyAmount);
                    esBen.setBgAmount(amountInRub);
                }
            }
        }

        // id компании должен приходить обязательно, ИНН/ОГРН/КПП не редактируются напрямую
        String companyId = vmBen.getCompanyId();
        Company company = companyRepository.load(vmBen.getCompanyId());

        if (!Objects.equals(companyId, esBen.getCompanyId())) {
            log.info("  ben companyId changed: new - {}, old - {}", companyId, esBen.getCompanyId());
            esBen.setCompanyId(companyId);
            beneficiaryUpdated = true;
        }

        String inn = company.getINN();
        if (!inn.equals(esBen.getInn())) {
            log.info("  ben inn changed: new - {}, old - {}", inn, esBen.getInn());
            esBen.setInn(inn);
            beneficiaryUpdated = true;
        }

        String ogrn = company.getOGRN();
        if (!ogrn.equals(esBen.getOgrn())) {
            log.info("  ben ogrn changed: new - {}, old - {}", ogrn, esBen.getOgrn());
            esBen.setOgrn(ogrn);
            beneficiaryUpdated = true;
        }

        String displayName = vmBen.getDisplayName();
        if (isNotBlank(displayName) && !displayName.equals(esBen.getDisplayName())) {
            log.info("  ben displayName changed: new - '{}', old - '{}'", displayName, esBen.getDisplayName());
            esBen.setDisplayName(displayName);
        }

        FzCBgProductEditModel.BeneficiaryContract vmBenContract = vmBen.getContract();
        if (vmBenContract != null) {
            ProductBg.BeneficiaryContract newContract = new ProductBg.BeneficiaryContract();
            newContract.setContractDate(vmBenContract.getContractDate());
            newContract.setContractNumber(vmBenContract.getContractNumber());
            esBen.setContract(newContract);
        }
        FzCBgProductEditModel.BeneficiaryContacts vmBenContacts = vmBen.getContacts();
        if (vmBenContacts != null) {
            BeneficiaryContacts esBenContacts = new BeneficiaryContacts();
            esBenContacts.setEmail(vmBenContacts.getEmail());
            esBenContacts.setPhone(vmBenContacts.getPhone());
            esBen.setContacts(esBenContacts);
        }

        log.info("  beneficiary updated: {}", beneficiaryUpdated);
        return beneficiaryUpdated;
    }

    private void checkBeneficiaryContacts(FzCBgProductEditModel.Beneficiary vmBen, FzCBgProductEditModel.Lot lot) {
        if (lot.getNeedSMP() || isSmp) {
            FzCBgProductEditModel.BeneficiaryContacts vmContacts = vmBen.getContacts();
            if (vmContacts == null) {
                throw new RuntimeException("Для генерации МСП макета необходимо заполнить контактные данные бенефициара");
            }
            if (StringUtils.isBlank(vmContacts.getPhone())) {
                throw new RuntimeException("Для генерации МСП макета необходимо заполнить контактный телефон бенефициара");
            }
            if (StringUtils.isBlank(vmContacts.getEmail())) {
                throw new RuntimeException("Для генерации МСП макета необходимо заполнить адрес электронной почты бенефициара");
            }
        }
    }

    private boolean isBeneficiaryContactsChanged(FzCBgProductEditModel.Beneficiary vmBen, ProductBg.Beneficiary esBen) {
        BeneficiaryContacts esContacts = esBen.getContacts();
        FzCBgProductEditModel.BeneficiaryContacts vmBenContacts = vmBen.getContacts();


        return (vmBenContacts != null || esContacts != null)
                && (vmBenContacts == null || esContacts == null
                || !Objects.equals(vmBenContacts.getPhone(), esContacts.getPhone())
                || !Objects.equals(vmBenContacts.getEmail(), esContacts.getEmail()));
    }

    private boolean isBeneficiaryContractChanged(FzCBgProductEditModel.Beneficiary vmBen, ProductBg.Beneficiary esBen) {
        ProductBg.BeneficiaryContract esContacts = esBen.getContract();
        FzCBgProductEditModel.BeneficiaryContract vmBenContacts = vmBen.getContract();

        return (vmBenContacts != null || esContacts != null)
                && (vmBenContacts == null || esContacts == null
                || !Objects.equals(vmBenContacts.getContractDate(), esContacts.getContractDate())
                || !Objects.equals(vmBenContacts.getContractNumber(), esContacts.getContractNumber()));
    }

    private Long calculateAmountByCurrentRate(Long amount) {

        BigDecimal currentRate = currencyMoneyService.calculatedRate(orderId);
        return MoneyUtils.moneyToLong(
                MoneyUtils.toRubles(amount).multiply(currentRate)
        );
    }

    private List<FzCBgProductModel.RefItem> loadRef(String refName) {
        String resString = esRepository.search("ref", refName, null, 10000, "");
        SpinJsonNode resJson = JSON(resString);

        List<FzCBgProductModel.RefItem> refItems = new ArrayList<>();

        for (SpinJsonNode node : resJson.elements()) {
            String code = node.prop("_id").stringValue();
            String name = node.prop("_source").prop("name").stringValue();

            FzCBgProductModel.RefItem item = new FzCBgProductModel.RefItem();
            item.setCode(code);
            item.setName(name);
            refItems.add(item);
        }

        return refItems;
    }

    private String getOldPurchaseNumber(String productId) {

        return  Optional.ofNullable(genParamService.loadOne("product", productId, "product.purchaseNumber.old"))
                .map(GenParam::getValue)
                .map(GenParam.GenParamValue::getStringValue)
                .orElse(null);
    }
}
